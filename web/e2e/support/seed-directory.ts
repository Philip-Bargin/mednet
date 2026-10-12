import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { request, type APIRequestContext } from "@playwright/test";
import { liveAdmin } from "./live-backend";

/**
 * Seeds the live API through its real endpoints only (no database writes):
 * admin creates and verifies accounts, creates and approves the provider record, and each
 * provider publishes availability from their own session.
 *
 * The admin session cookie is saved and reused across specs. This was needed while the configured super
 * admin could sign in only once per API process (fixed in Phase 4E); it now just saves sign-ins.
 */
const ADMIN_STATE = path.join(os.tmpdir(), "mednet-live-admin-state.json");

export type SeededProvider = { id: string; email: string; displayName: string; specialty: string; slotIds: string[] };

async function csrfHeaders(context: APIRequestContext) {
  const csrf = await (await context.get("/api/v1/auth/csrf")).json();
  return { [csrf.headerName]: csrf.token } as Record<string, string>;
}

async function ok(response: Awaited<ReturnType<APIRequestContext["post"]>>, what: string) {
  if (!response.ok()) throw new Error(`${what} failed: ${response.status()} ${await response.text()}`);
  const text = await response.text();
  return text ? JSON.parse(text) : undefined;
}

export async function signedInContext(baseURL: string, email: string, password: string) {
  const context = await request.newContext({ baseURL });
  const response = await context.post("/api/v1/auth/login", {
    form: { email, password },
    headers: await csrfHeaders(context),
  });
  if (response.status() !== 204) throw new Error(`Sign-in for ${email} failed: ${response.status()}`);
  return context;
}

export async function adminContext(baseURL: string) {
  if (fs.existsSync(ADMIN_STATE)) {
    const saved = await request.newContext({ baseURL, storageState: ADMIN_STATE });
    const session = await saved.get("/api/v1/auth/session");
    if (session.ok() && (await session.json()).role === "SUPER_ADMIN") return saved;
    await saved.dispose();
  }
  if (!liveAdmin.email || !liveAdmin.password) throw new Error("Set MEDNET_LIVE_ADMIN_EMAIL and MEDNET_LIVE_ADMIN_PASSWORD");
  const context = await signedInContext(baseURL, liveAdmin.email, liveAdmin.password);
  fs.mkdirSync(path.dirname(ADMIN_STATE), { recursive: true });
  await context.storageState({ path: ADMIN_STATE });
  return context;
}

/** Creates an ACTIVE, email-verified account. */
export async function createVerifiedAccount(
  admin: APIRequestContext,
  { email, displayName, accountType, password }: { email: string; displayName: string; accountType: string; password: string },
) {
  const account = await ok(
    await admin.post("/api/v1/admin/accounts", {
      data: { email, displayName, accountType, password },
      headers: await csrfHeaders(admin),
    }),
    `create ${accountType} ${email}`,
  );
  await ok(
    await admin.patch(`/api/v1/admin/accounts/${account.id}/verification`, {
      data: { emailVerified: true },
      headers: await csrfHeaders(admin),
    }),
    `verify ${email}`,
  );
  return account as { id: string };
}

export async function seedProvider(
  baseURL: string,
  admin: APIRequestContext,
  { email, displayName, specialty, password, slots }: {
    email: string;
    displayName: string;
    specialty: string;
    password: string;
    slots: Array<{ startsAt: Date; minutes: number; mode: "IN_PERSON" | "TEXT" }>;
  },
): Promise<SeededProvider> {
  await createVerifiedAccount(admin, { email, displayName, accountType: "PROVIDER", password });
  const application = await ok(
    await admin.post("/api/v1/admin/providers", {
      data: { email, displayName, specialty, credentialReference: `LIVE-TEST-${Date.now()}` },
      headers: await csrfHeaders(admin),
    }),
    `create provider ${email}`,
  );
  await ok(
    await admin.patch(`/api/v1/admin/providers/${application.id}/status`, {
      data: { status: "APPROVED" },
      headers: await csrfHeaders(admin),
    }),
    `approve ${email}`,
  );

  const provider = await signedInContext(baseURL, email, password);
  const slotIds: string[] = [];
  for (const slot of slots) {
    const created = await ok(
      await provider.post("/api/v1/providers/me/availability", {
        data: {
          startsAt: slot.startsAt.toISOString(),
          endsAt: new Date(slot.startsAt.getTime() + slot.minutes * 60_000).toISOString(),
          consultationMode: slot.mode,
        },
        headers: await csrfHeaders(provider),
      }),
      `availability for ${email}`,
    );
    slotIds.push(created.id);
  }
  await provider.dispose();
  return { id: application.id, email, displayName, specialty, slotIds };
}

/** Completes the patient profile required before booking (PUT /patients/me/profile). */
export async function completePatientProfile(patient: APIRequestContext, fullName: string) {
  await ok(
    await patient.put("/api/v1/patients/me/profile", {
      data: { fullName, dateOfBirth: "1990-01-15", phoneNumber: "+231770000000", address: "Test address, Monrovia" },
      headers: await csrfHeaders(patient),
    }),
    "complete patient profile",
  );
}

export async function requestAppointmentAs(patient: APIRequestContext, slotId: string) {
  return patient.post("/api/v1/appointments", { data: { availabilitySlotId: slotId }, headers: await csrfHeaders(patient) });
}

import type { Page, Request } from "@playwright/test";

/**
 * In-browser stand-in for /api/v1/admin/** (shapes from AdminWorkflowModels, AdminOverviewController,
 * AdminRequestSummary and AdminAppointmentSummary). Like the backend, it refuses SUPER_ADMIN-only
 * calls from an ADMIN session with 403, so the specs prove the UI copes with the server's answer.
 * Real integration is covered by admin.live.spec.ts.
 */
const hour = 3_600_000;
const iso = (offsetHours: number) => new Date(Date.now() + offsetHours * hour).toISOString();
const json = (body: unknown, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const problem = (status: number, message: string) =>
  json({ success: false, error: { code: `HTTP_${status}`, message, details: [] }, detail: message }, status);

export type AdminStubOptions = {
  role?: "SUPER_ADMIN" | "ADMIN" | "PATIENT" | "PROVIDER";
  signedOut?: boolean;
  /** Paths answered with 403 (simulates the server refusing). */
  forbidden?: string[];
  empty?: boolean;
};

export type AdminStubLog = {
  requests: Array<{ method: string; path: string; body: unknown; csrf: string | null }>;
  expireSession: () => void;
};

const SELF = "admin@mednet.test";

function account(id: string, publicId: string, displayName: string, email: string, accountType: string, extra: Record<string, unknown> = {}) {
  return { id, publicId, displayName, email, accountType, status: "ACTIVE", emailVerified: true, createdAt: iso(-200), updatedAt: iso(-100), ...extra };
}

/** Spring Data page of `rows` for the request's `page`/`size` (as the paged admin endpoints answer). */
function pageOf<T>(rows: T[], url: URL) {
  const size = Number(url.searchParams.get("size") ?? 25);
  const number = Number(url.searchParams.get("page") ?? 0);
  return { content: rows.slice(number * size, number * size + size), totalElements: rows.length, totalPages: Math.ceil(rows.length / size), number, size };
}

export async function stubAdminApi(page: Page, options: AdminStubOptions = {}): Promise<AdminStubLog> {
  let expired = false;
  let signedOut = options.signedOut ?? false;
  const role = options.role ?? "SUPER_ADMIN";
  const accounts = options.empty
    ? [account("acc-self", "SA-SELF00000000", "Platform Admin", SELF, role)]
    : [
        account("acc-self", "SA-SELF00000000", "Platform Admin", SELF, role),
        account("acc-james", "PT-JAMES0000000", "James Brown", "james@example.test", "PATIENT"),
        account("acc-lab", "LB-LAB000000000", "Grace Lab", "grace.lab@example.test", "LABORATORY"),
        account("acc-hc", "HC-HOME00000000", "Peter Care", "peter.care@example.test", "HOME_CARE"),
        account("acc-new", "PT-NEW000000000", "Unverified Person", "new@example.test", "PATIENT", { emailVerified: false }),
        account("acc-susp", "PR-SUSP00000000", "Suspended Doctor", "susp@example.test", "PROVIDER", { status: "SUSPENDED" }),
        account("acc-peer", "AD-PEER00000000", "Peer Administrator", "peer@example.test", "ADMIN"),
      ];
  const providers = options.empty
    ? []
    : [
        { id: "app-cole", displayName: "Dr. Mariama Cole", email: "cole@example.test", specialty: "Family medicine", credentialReference: "LMDC-2041", status: "PENDING", createdAt: iso(-3), reviewedAt: null, reviewedBy: null },
        { id: "app-weah", displayName: "Dr. Joseph Weah", email: "weah@example.test", specialty: "Paediatrics", credentialReference: "LMDC-1150", status: "APPROVED", createdAt: iso(-300), reviewedAt: iso(-250), reviewedBy: SELF },
      ];
  const requests = options.empty
    ? []
    : [{ id: "req-1", referenceId: "OPS-1042", requestType: "APPOINTMENT", requesterEmail: "caller@example.test", status: "OPEN", createdAt: iso(-5), updatedAt: iso(-5) }];
  const serviceRequests = options.empty
    ? []
    : [
        { id: "5c1e2f00-aaaa-4bbb-8ccc-000000000001", requestType: "HOME_CARE", status: "OPEN", createdAt: iso(-6), assignedStaffPublicId: null as string | null },
        { id: "5c1e2f00-aaaa-4bbb-8ccc-000000000002", requestType: "LABORATORY", status: "OPEN", createdAt: iso(-4), assignedStaffPublicId: null as string | null },
        { id: "5c1e2f00-aaaa-4bbb-8ccc-000000000003", requestType: "HOME_CARE", status: "RESOLVED", createdAt: iso(-90), assignedStaffPublicId: "HC-HOME00000000" as string | null },
        { id: "6d2f3a00-aaaa-4bbb-8ccc-000000000004", requestType: "LABORATORY", status: "OPEN", createdAt: iso(-3), assignedStaffPublicId: "LB-LAB000000000" as string | null },
      ];
  const appointments = options.empty
    ? []
    : [
        { id: "9a8b7c6d-0000-4000-8000-000000000001", patientAccountId: "acc-james", providerApplicationId: "app-weah", status: "CONFIRMED", consultationMode: "TEXT", startsAt: iso(30), endsAt: iso(30.5), createdAt: iso(-20), updatedAt: iso(-10) },
      ];
  const audit = options.empty
    ? []
    : [
        { id: "ev-1", actorEmail: SELF, action: "account.suspended", resourceType: "account", resourceId: "acc-susp", createdAt: iso(-1) },
        { id: "ev-2", actorEmail: SELF, action: "provider.approved", resourceType: "provider", resourceId: "app-weah", createdAt: iso(-250) },
        { id: "ev-3", actorEmail: "james@example.test", action: "record_consent.granted", resourceType: "record_consent", resourceId: "rc-1", createdAt: iso(-300) },
      ];
  const log: AdminStubLog = { requests: [], expireSession: () => (expired = true) };
  const superOnly = (method: string, path: string) =>
    (method === "PUT" && /^\/admin\/accounts\/[^/]+$/.test(path)) ||
    (method === "DELETE" && /^\/admin\/accounts\/[^/]+$/.test(path)) ||
    /^\/admin\/accounts\/[^/]+\/(verification|role)$/.test(path);

  await page.route("**/api/v1/**", async (route, request: Request) => {
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/v1", "");
    const method = request.method();
    const body = request.postData() ? JSON.parse(request.postData()!) : undefined;
    if (method !== "GET") log.requests.push({ method, path, body, csrf: request.headers()["x-xsrf-token"] ?? null });

    if (path === "/auth/csrf") return route.fulfill(json({ headerName: "X-XSRF-TOKEN", token: "test-token" }));
    if (path === "/auth/google/status") return route.fulfill(json({ enabled: false }));
    if (path === "/auth/logout") {
      signedOut = true;
      return route.fulfill({ status: 204 });
    }
    if (expired || (signedOut && path !== "/auth/session")) return route.fulfill(problem(401, "Sign-in required"));
    if (path === "/auth/session") {
      return signedOut ? route.fulfill(problem(401, "Sign-in required")) : route.fulfill(json({ email: SELF, role }));
    }
    if (path.startsWith("/admin") && role !== "SUPER_ADMIN" && role !== "ADMIN") return route.fulfill(problem(403, "You do not have permission to perform this action"));
    if (options.forbidden?.includes(path)) return route.fulfill(problem(403, "You do not have permission to perform this action"));
    if (role === "ADMIN" && superOnly(method, path)) return route.fulfill(problem(403, "You do not have permission to perform this action"));

    if (path === "/admin/overview") {
      const open = serviceRequests.filter((r) => r.status === "OPEN" || r.status === "IN_PROGRESS");
      return route.fulfill(
        json({
          apiStatus: "UP",
          checkedAt: iso(0),
          uptimeSeconds: 93_600,
          counts: {
            pendingProviders: providers.filter((p) => p.status === "PENDING").length,
            activeAccounts: accounts.filter((a) => a.status === "ACTIVE").length,
            openRequests: open.length + requests.filter((r) => r.status === "OPEN" || r.status === "IN_PROGRESS").length,
            openHomeCareRequests: open.filter((r) => r.requestType === "HOME_CARE").length,
            openLaboratoryRequests: open.filter((r) => r.requestType === "LABORATORY").length,
          },
          modules: [
            { key: "providerReview", status: "CONNECTED" },
            { key: "accountSupport", status: "CONNECTED" },
            { key: "textConsultations", status: "CONNECTED" },
            { key: "virtualConsultation", status: "DISABLED" },
          ],
        }),
      );
    }

    if (path === "/admin/providers") {
      if (method === "POST") {
        const created = { id: `app-${providers.length + 1}`, ...body, status: "PENDING", createdAt: iso(0), reviewedAt: null, reviewedBy: null };
        providers.unshift(created);
        return route.fulfill(json(created));
      }
      const status = url.searchParams.get("status");
      const q = (url.searchParams.get("search") ?? "").toLowerCase();
      const matching = providers.filter(
        (p) => (!status || p.status === status) && (!q || [p.displayName, p.email, p.specialty, p.credentialReference].some((v) => String(v).toLowerCase().includes(q))),
      );
      return route.fulfill(json(url.searchParams.has("page") ? pageOf(matching, url) : matching.slice(0, 100)));
    }
    const review = path.match(/^\/admin\/providers\/([^/]+)\/status$/);
    if (review) {
      const target = providers.find((p) => p.id === review[1]);
      if (!target) return route.fulfill(problem(404, "Provider application not found"));
      Object.assign(target, { status: body.status, reviewedAt: iso(0), reviewedBy: SELF });
      return route.fulfill(json(target));
    }

    if (path === "/admin/accounts") {
      if (method === "POST") {
        if (!["PATIENT", "PROVIDER", "LABORATORY", "HOME_CARE"].includes(body.accountType)) return route.fulfill(problem(400, "Unsupported status or type"));
        if (accounts.some((a) => a.email === body.email)) return route.fulfill(problem(409, "An account with this email already exists"));
        const created = account(`acc-${accounts.length + 1}`, `PT-CREATED${accounts.length}`, body.displayName, body.email, body.accountType, { emailVerified: false });
        accounts.unshift(created);
        return route.fulfill(json(created));
      }
      const q = (url.searchParams.get("search") ?? "").toLowerCase();
      const status = url.searchParams.get("status");
      const type = url.searchParams.get("accountType");
      const verified = url.searchParams.get("emailVerified");
      const size = Number(url.searchParams.get("size") ?? 25);
      const pageNumber = Number(url.searchParams.get("page") ?? 0);
      const matching = accounts.filter(
        (a) =>
          (!q || [a.displayName, a.email, a.publicId].some((v) => String(v).toLowerCase().includes(q))) &&
          (!status || a.status === status) &&
          (!type || a.accountType === type) &&
          (verified === null || String(a.emailVerified) === verified),
      );
      return route.fulfill(
        json({
          content: matching.slice(pageNumber * size, pageNumber * size + size),
          totalElements: matching.length,
          totalPages: Math.ceil(matching.length / size),
          number: pageNumber,
          size,
        }),
      );
    }
    const accountPath = path.match(/^\/admin\/accounts\/([^/]+)(?:\/(status|verification))?$/);
    if (accountPath) {
      const target = accounts.find((a) => a.id === accountPath[1]);
      if (!target) return route.fulfill(problem(404, "Platform account not found"));
      if (method === "DELETE") {
        accounts.splice(accounts.indexOf(target), 1);
        return route.fulfill({ status: 204 });
      }
      if (accountPath[2] === "status") {
        // Phase 4F: only SUPER_ADMIN may change the status of ADMIN or SUPER_ADMIN accounts.
        if (role === "ADMIN" && ["ADMIN", "SUPER_ADMIN"].includes(target.accountType)) {
          return route.fulfill(problem(403, "Only a super administrator can suspend or reactivate administrator accounts"));
        }
        Object.assign(target, { status: body.status });
      }
      else if (accountPath[2] === "verification") Object.assign(target, { emailVerified: body.emailVerified });
      else Object.assign(target, { displayName: body.displayName, email: body.email, accountType: body.accountType });
      return route.fulfill(json(target));
    }

    if (path === "/admin/requests") {
      if (method === "POST") {
        const created = { id: `req-${requests.length + 1}`, ...body, status: "OPEN", createdAt: iso(0), updatedAt: iso(0) };
        requests.unshift(created);
        return route.fulfill(json(created));
      }
      return route.fulfill(json(url.searchParams.has("page") ? pageOf(requests, url) : requests));
    }
    const requestStatus = path.match(/^\/admin\/requests\/([^/]+)\/status$/);
    if (requestStatus) {
      const target = requests.find((r) => r.id === requestStatus[1])!;
      Object.assign(target, { status: body.status, updatedAt: iso(0) });
      return route.fulfill(json(target));
    }

    if (path === "/admin/service-requests") {
      const statuses = url.searchParams.getAll("status");
      const matching = serviceRequests.filter((r) => r.requestType === url.searchParams.get("type") && (!statuses.length || statuses.includes(r.status)));
      return route.fulfill(json(url.searchParams.has("page") ? pageOf(matching, url) : matching));
    }
    const serviceStatus = path.match(/^\/admin\/service-requests\/([^/]+)\/(status|assignment)$/);
    if (serviceStatus) {
      const target = serviceRequests.find((r) => r.id === serviceStatus[1])!;
      if (serviceStatus[2] === "assignment") {
        if (target.assignedStaffPublicId) return route.fulfill(problem(409, "Only unassigned open requests can be assigned"));
        target.assignedStaffPublicId = accounts.find((a) => a.id === body.staffAccountId)?.publicId ?? null;
        return route.fulfill(json({ requestId: target.id, assignedStaffAccountId: body.staffAccountId, requestType: target.requestType, status: target.status }));
      }
      Object.assign(target, { status: body.status });
      return route.fulfill(json(target));
    }

    if (path === "/admin/appointments") {
      return route.fulfill(json({ content: appointments, totalElements: appointments.length, totalPages: appointments.length ? 1 : 0, number: 0, size: 25 }));
    }
    if (path === "/admin/audit/resource-types") return route.fulfill(json([...new Set(audit.map((event) => event.resourceType))].sort()));
    if (path === "/admin/audit") {
      if (!url.searchParams.has("page")) return route.fulfill(json(audit));
      const q = (url.searchParams.get("search") ?? "").toLowerCase();
      const type = url.searchParams.get("resourceType");
      const labelActions = url.searchParams.getAll("labelAction");
      const matching = audit.filter(
        (event) =>
          (!type || event.resourceType === type) &&
          (!q ||
            [event.actorEmail, event.action, event.action.replaceAll(/[._]/g, " "), event.resourceId].some((v) => v.toLowerCase().includes(q)) ||
            labelActions.includes(event.action)),
      );
      return route.fulfill(json(pageOf(matching, url)));
    }

    return route.fulfill(problem(404, `Unstubbed ${method} ${path}`));
  });
  return log;
}

import { describe, expect, it } from "vitest";
import { WORKSPACES } from "@/features/workspace/workspaces";
import { generatePassword } from "./admin-api";
import { formatAdminDateTime } from "./frame";
import {
  adminCapabilities,
  canChangeStatusOf,
  auditActionLabel,
  isAdminRole,
  providerStatus,
  routeBelongsToWorkspace,
  shortReference,
  workspaceIdForRole,
} from "./permissions";

describe("administrative permissions", () => {
  it("mirrors the backend: only SUPER_ADMIN edits, verifies and deletes accounts", () => {
    expect(adminCapabilities("SUPER_ADMIN")).toEqual({
      manageAccountStatus: true,
      editAccounts: true,
      changeVerification: true,
      deleteAccounts: true,
    });
    expect(adminCapabilities("ADMIN")).toEqual({
      manageAccountStatus: true,
      editAccounts: false,
      changeVerification: false,
      deleteAccounts: false,
    });
  });

  it("lets only a super administrator change the status of administrator accounts", () => {
    for (const type of ["ADMIN", "SUPER_ADMIN"]) {
      expect(canChangeStatusOf("ADMIN", type)).toBe(false);
      expect(canChangeStatusOf("SUPER_ADMIN", type)).toBe(true);
    }
    for (const type of ["PATIENT", "PROVIDER", "LABORATORY", "HOME_CARE"]) expect(canChangeStatusOf("ADMIN", type)).toBe(true);
  });

  it("admits only the two administrative roles", () => {
    expect(isAdminRole("ADMIN")).toBe(true);
    expect(isAdminRole("SUPER_ADMIN")).toBe(true);
    for (const role of ["PATIENT", "PROVIDER", "LABORATORY", "HOME_CARE", "admin", ""]) expect(isAdminRole(role)).toBe(false);
  });

  it("picks the workspace menu from the role", () => {
    expect(workspaceIdForRole("SUPER_ADMIN")).toBe("super-admin");
    expect(workspaceIdForRole("ADMIN")).toBe("admin");
  });

  it("keeps super-administrator pages out of the administrator workspace", () => {
    for (const path of ["/admin", "/admin/tasks", "/admin/onboarding", "/admin/appointments", "/admin/escalations", "/admin/reports"]) {
      expect(routeBelongsToWorkspace("ADMIN", path)).toBe(true);
    }
    for (const path of ["/admin/users", "/admin/verification", "/admin/security", "/admin/configuration", "/admin/providers", "/admin/unknown"]) {
      expect(routeBelongsToWorkspace("ADMIN", path)).toBe(false);
    }
    for (const path of ["/admin", "/admin/users", "/admin/providers", "/admin/verification", "/admin/security", "/admin/configuration", "/admin/tasks", "/admin/appointments"]) {
      expect(routeBelongsToWorkspace("SUPER_ADMIN", path)).toBe(true);
    }
    expect(routeBelongsToWorkspace("SUPER_ADMIN", "/admin/escalations")).toBe(false);
    expect(routeBelongsToWorkspace("SUPER_ADMIN", "/admin/users-export")).toBe(false);
  });

  it("keeps the reference's six menu items for each role, in order", () => {
    expect(WORKSPACES["super-admin"].items.slice(0, 6).map((item) => item.label)).toEqual([
      "Overview",
      "Users and roles",
      "Providers",
      "Verification",
      "Security",
      "Configuration",
    ]);
    expect(WORKSPACES.admin.items.map((item) => item.label)).toEqual([
      "Overview",
      "Task queue",
      "Onboarding",
      "Appointments",
      "Escalations",
      "Reports",
    ]);
  });
});

describe("administrative presentation", () => {
  it("never calls an approved provider verified", () => {
    expect(providerStatus("APPROVED").label).toBe("Approved");
    for (const status of ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"]) {
      expect(providerStatus(status).label.toLowerCase()).not.toContain("verif");
    }
    expect(providerStatus("SOMETHING_NEW").tone).toBe("neutral");
  });

  it("labels audit actions, falling back to readable text", () => {
    expect(auditActionLabel("account.suspended")).toBe("Account suspended");
    expect(auditActionLabel("provider.approved")).toBe("Provider application approved");
    expect(auditActionLabel("record_consent.granted")).toBe("Record consent granted");
  });

  it("shortens internal identifiers", () => {
    expect(shortReference("3f2a9c1e-55b0-4d4e-9a37-0c1d2e3f4a5b")).toBe("3F2A9C1E");
  });

  it("shows times in Liberia time (GMT)", () => {
    expect(formatAdminDateTime("2026-10-11T23:30:00Z")).toMatch(/11 Oct 2026.*23:30/);
  });

  it("generates passwords inside the 12–72 character rule", () => {
    const first = generatePassword();
    expect(first).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(generatePassword()).not.toBe(first);
  });
});

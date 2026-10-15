import { describe, expect, it } from "vitest";
import {
  WORKSPACES,
  WORKSPACE_IDS,
  activeNavItemId,
  homePathForRole,
} from "./workspaces";

describe("workspace registry", () => {
  it("covers every workspace in the approved reference", () => {
    expect(WORKSPACE_IDS).toEqual([
      "patient",
      "doctor",
      "laboratory",
      "home-care",
      "collection-provider",
      "collection-agent",
      "super-admin",
      "admin",
      "support",
      "finance",
      "specimen-lifecycle",
      "permissions-matrix",
    ]);
  });

  it("does not invent backend roles for workspaces the API cannot serve yet", () => {
    for (const id of ["collection-provider", "collection-agent", "support", "finance", "specimen-lifecycle", "permissions-matrix"] as const) {
      expect(WORKSPACES[id].backendRole).toBeNull();
      expect(WORKSPACES[id].preview).toBe(true);
      expect(WORKSPACES[id].basePath.startsWith("/preview/")).toBe(true);
      expect(WORKSPACES[id].items.every((item) => item.backend === "none")).toBe(true);
    }
  });

  it("marks payment and payout views as presentation-only", () => {
    const paymentItems = WORKSPACE_IDS.flatMap((id) => WORKSPACES[id].items).filter((item) =>
      /payment|payout|earning|refund|reconciliation|transaction/i.test(item.label),
    );
    expect(paymentItems.length).toBeGreaterThan(0);
    expect(paymentItems.every((item) => item.backend === "none")).toBe(true);
  });

  it("keeps every real workspace out of /preview", () => {
    for (const id of ["patient", "doctor", "laboratory", "home-care", "super-admin", "admin"] as const) {
      expect(WORKSPACES[id].preview).toBeUndefined();
      expect(WORKSPACES[id].basePath.startsWith("/preview")).toBe(false);
    }
  });

  it("keeps hrefs unique inside each workspace", () => {
    for (const id of WORKSPACE_IDS) {
      const hrefs = WORKSPACES[id].items.map((item) => item.href);
      expect(new Set(hrefs).size).toBe(hrefs.length);
    }
  });
});

describe("homePathForRole", () => {
  it("matches the existing sign-in redirects", () => {
    expect(homePathForRole("ADMIN")).toBe("/admin");
    expect(homePathForRole("SUPER_ADMIN")).toBe("/admin");
    expect(homePathForRole("PATIENT")).toBe("/patient");
    expect(homePathForRole("PROVIDER")).toBe("/provider");
    expect(homePathForRole("LABORATORY")).toBe("/laboratory");
    expect(homePathForRole("HOME_CARE")).toBe("/home-care");
    expect(homePathForRole("USER")).toBe("/account");
  });
});

describe("activeNavItemId", () => {
  const patient = WORKSPACES.patient;

  it("selects Overview only on the workspace root", () => {
    expect(activeNavItemId(patient, "/patient")).toBe("overview");
  });

  it("prefers the longest matching section for nested paths", () => {
    expect(activeNavItemId(patient, "/patient/records/42")).toBe("records");
  });

  it("does not match sibling paths that share a prefix", () => {
    expect(activeNavItemId(patient, "/patients")).toBeUndefined();
  });
});

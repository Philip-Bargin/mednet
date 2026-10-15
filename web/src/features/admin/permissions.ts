import type { BadgeTone } from "@/components/ui/badge";
import { WORKSPACES } from "@/features/workspace/workspaces";

/**
 * What each administrative role may do, transcribed from the backend (SecurityConfig and
 * AdminWorkflowController `@PreAuthorize`). It decides which controls are shown; the API enforces
 * every rule again, so hiding a control is never the protection.
 */
export type AdminRole = "ADMIN" | "SUPER_ADMIN";

export type AdminCapabilities = {
  /** List, create (non-privileged types), suspend and reactivate accounts. Both roles. */
  manageAccountStatus: boolean;
  /** Edit name, email, type and password (`PUT /admin/accounts/{id}`). SUPER_ADMIN only. */
  editAccounts: boolean;
  /** `PATCH /admin/accounts/{id}/verification`. SUPER_ADMIN only. */
  changeVerification: boolean;
  /** `DELETE /admin/accounts/{id}`. SUPER_ADMIN only. */
  deleteAccounts: boolean;
};

export function isAdminRole(role: string): role is AdminRole {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function adminCapabilities(role: AdminRole): AdminCapabilities {
  const superAdmin = role === "SUPER_ADMIN";
  return {
    manageAccountStatus: true,
    editAccounts: superAdmin,
    changeVerification: superAdmin,
    deleteAccounts: superAdmin,
  };
}

/**
 * Whether this role may suspend or reactivate an account of `targetType`. Since Phase 4F the API
 * refuses (403) an ADMIN changing the status of ADMIN or SUPER_ADMIN accounts.
 */
export function canChangeStatusOf(role: AdminRole, targetType: string): boolean {
  return role === "SUPER_ADMIN" || (targetType !== "ADMIN" && targetType !== "SUPER_ADMIN");
}

export function workspaceIdForRole(role: AdminRole): "super-admin" | "admin" {
  return role === "SUPER_ADMIN" ? "super-admin" : "admin";
}

/** Routes that exist under /admin but belong to the other administrative workspace's menu. */
export function routeBelongsToWorkspace(role: AdminRole, pathname: string): boolean {
  if (pathname === "/admin") return true;
  // The overview link ("/admin") prefixes every route, so only the other menu items count here.
  return WORKSPACES[workspaceIdForRole(role)].items.some(
    (item) => item.href !== "/admin" && (pathname === item.href || pathname.startsWith(`${item.href}/`)),
  );
}

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  PATIENT: "Patient",
  PROVIDER: "Provider",
  LABORATORY: "Laboratory staff",
  HOME_CARE: "Home-care staff",
  ADMIN: "Administrator",
  SUPER_ADMIN: "Super administrator",
};

export function accountTypeLabel(type: string): string {
  return ACCOUNT_TYPE_LABELS[type] ?? type;
}

/** `provider_applications.status`. "Approved" is an administrative decision; MedNet does not verify credentials. */
export const PROVIDER_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  PENDING: { label: "Awaiting review", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Not approved", tone: "critical" },
  SUSPENDED: { label: "Suspended", tone: "critical" },
};

export function providerStatus(status: string) {
  return PROVIDER_STATUS[status] ?? { label: status.toLowerCase(), tone: "neutral" as BadgeTone };
}

export const ACCOUNT_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: "Active", tone: "success" },
  SUSPENDED: { label: "Suspended", tone: "critical" },
};

export function accountStatus(status: string) {
  return ACCOUNT_STATUS[status] ?? { label: status.toLowerCase(), tone: "neutral" as BadgeTone };
}

export const REQUEST_TYPE_LABELS: Record<string, string> = {
  APPOINTMENT: "Appointment",
  HOME_CARE: "Home care",
  LABORATORY: "Laboratory",
};

/** Module keys from `AdminOverviewController`. */
export const MODULE_LABELS: Record<string, string> = {
  providerReview: "Provider applications",
  accountSupport: "Account management",
  serviceRequests: "Service requests",
  auditTrail: "Administrative audit trail",
  messaging: "Messaging",
  medication: "Medication",
  vitals: "Vitals",
  notifications: "Notifications",
  homeCare: "Home care",
  laboratory: "Laboratory",
  textConsultations: "Text consultations",
  virtualConsultation: "Video and voice consultations",
};

export function moduleStatus(status: string): { label: string; tone: BadgeTone } {
  switch (status) {
    case "CONNECTED":
      return { label: "Available", tone: "success" };
    case "DISABLED":
      return { label: "Not implemented", tone: "neutral" };
    case "NOT_CONFIGURED":
      return { label: "Database not configured", tone: "warning" };
    default:
      return { label: status.toLowerCase(), tone: "neutral" };
  }
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  "provider.created": "Provider application added",
  "provider.approved": "Provider application approved",
  "provider.rejected": "Provider application not approved",
  "provider.suspended": "Provider suspended",
  "provider.pending": "Provider application returned to review",
  "account.created": "Account created",
  "account.updated": "Account details changed",
  "account.active": "Account reactivated",
  "account.suspended": "Account suspended",
  "account.role_changed": "Account type changed",
  "account.verified": "Email marked verified",
  "account.verification_pending": "Email marked unverified",
  "account.deleted": "Account deleted",
  "request.created": "Operational request added",
  "request.in_progress": "Operational request started",
  "request.resolved": "Operational request resolved",
  "request.cancelled": "Operational request cancelled",
};

/** "provider.approved" → "Provider approved"; unknown actions are shown as written. */
export function auditActionLabel(action: string): string {
  const known = AUDIT_ACTION_LABELS;
  if (known[action]) return known[action];
  const words = action.replaceAll(/[._]/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Action codes whose readable label contains `term` (case-insensitive). The audit search sends them with
 * the term, because the server matches codes and words, not these labels (Phase 5D).
 */
export function auditActionsMatchingLabel(term: string): string[] {
  const needle = term.trim().toLowerCase();
  if (!needle) return [];
  return Object.entries(AUDIT_ACTION_LABELS)
    .filter(([, label]) => label.toLowerCase().includes(needle))
    .map(([action]) => action);
}

/** "AD-3K9F…" style short reference for internal ids that are not meant to be read. */
export function shortReference(value: string): string {
  return value.replaceAll("-", "").slice(0, 8).toUpperCase();
}

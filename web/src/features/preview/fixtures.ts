import type { BadgeTone } from "@/components/ui/badge";
import { fictional } from "@/lib/fictional";

/**
 * Fictional data for the preview workspaces (Phase 4G), taken from the approved reference. None of it
 * relates to a real person, request, payment or laboratory. Every value is wrapped in `fictional()` and
 * is only rendered inside /preview under the "Preview only — Fictional data" banner.
 */

export type PreviewRow = {
  ref: string;
  marker: string;
  title: string;
  meta: string;
  status: string;
  tone: BadgeTone;
  /** Selected-record details. */
  details: Array<{ term: string; detail: string }>;
};

export type PreviewSection = {
  id: string;
  title: string;
  description: string;
  rows: PreviewRow[];
  restricted: string;
  actions: string[];
};

/* ---------------- Collection provider ---------------- */

export const COLLECTION_METRICS = fictional([
  { value: "8", label: "Awaiting assignment", hint: "2 due today", tone: "warning" as const },
  { value: "14", label: "Scheduled", hint: "Across 5 agents", tone: "info" as const },
  { value: "6", label: "In transit", hint: "No overdue handoffs", tone: "success" as const },
  { value: "3", label: "Exceptions", hint: "Require coordination", tone: "critical" as const },
]);

const pickupRows: PreviewRow[] = [
  {
    ref: "PU-2084",
    marker: "PU",
    title: "Sinkor, Monrovia",
    meta: "09:30–10:30 · LAB-1042",
    status: "Unassigned",
    tone: "warning",
    details: [
      { term: "Patient reference", detail: "PT-10482 (fictional)" },
      { term: "Authorized contact", detail: "*** *** 4821" },
      { term: "Window", detail: "09:30–10:30" },
      { term: "Destination", detail: "Monrovia Central Lab (fictional)" },
      { term: "Authorized instruction", detail: "Identity check, EDTA tube, two-label match, controlled ambient transport." },
    ],
  },
  {
    ref: "PU-2081",
    marker: "PU",
    title: "Congo Town",
    meta: "11:00–12:00 · LAB-1041",
    status: "Scheduled",
    tone: "info",
    details: [
      { term: "Patient reference", detail: "PT-10376 (fictional)" },
      { term: "Agent", detail: "Agent MK" },
      { term: "Window", detail: "11:00–12:00" },
      { term: "Destination", detail: "Monrovia Central Lab (fictional)" },
    ],
  },
  {
    ref: "PU-2078",
    marker: "PU",
    title: "Paynesville",
    meta: "Transport to partner lab",
    status: "Delayed",
    tone: "critical",
    details: [
      { term: "Patient reference", detail: "PT-10218 (fictional)" },
      { term: "Agent", detail: "Agent TS" },
      { term: "Delay", detail: "24 minutes" },
      { term: "Destination", detail: "Partner laboratory (fictional)" },
    ],
  },
];

export const COLLECTION_PICKUPS = fictional(pickupRows);

export const COLLECTION_AGENTS = fictional([
  { initials: "JA", name: "Agent JA", pickups: 3 },
  { initials: "MK", name: "Agent MK", pickups: 2 },
  { initials: "TS", name: "Agent TS", pickups: 4 },
]);

export const COLLECTION_EXCEPTIONS = fictional([
  { kind: "Transport delay", title: "PU-2078 · 24 min late", detail: "Notify laboratory and update ETA" },
  { kind: "Missed pickup", title: "PU-2069 · Contact unavailable", detail: "Reason recorded · reschedule pending" },
]);

export const PROVIDER_PAYOUTS = fictional([
  { label: "Available balance", value: "USD 320.00", note: "Fictional demonstration amount" },
  { label: "Pending settlement", value: "USD 96.00", note: "Completed services under review" },
  { label: "Next payout", value: "Schedule pending", note: "After reconciliation" },
  { label: "Payout method", value: "Not collected", note: "MedNet collects no payment details" },
]);

const collectionRestricted = "No diagnosis, full medical record or laboratory result would be available to collection coordination.";

export const COLLECTION_SECTIONS = fictional<PreviewSection[]>([
  { id: "pickup-requests", title: "Pickup requests", description: "Coordinate pickup, transport and custody activity without laboratory processing access.", rows: pickupRows, restricted: collectionRestricted, actions: ["Assign pickup", "View activity"] },
  { id: "assignments", title: "Assignments", description: "Match pickups to available collection agents.", rows: pickupRows, restricted: collectionRestricted, actions: ["Change agent", "View activity"] },
  { id: "tracking", title: "Tracking", description: "Follow pickups from collection to laboratory receipt.", rows: pickupRows.slice(1), restricted: collectionRestricted, actions: ["View custody events"] },
  { id: "exceptions", title: "Exceptions", description: "Resolve transport delays and missed pickups.", rows: [pickupRows[2]], restricted: collectionRestricted, actions: ["Record resolution", "Notify laboratory"] },
  {
    id: "pricing-payouts",
    title: "Pricing & payouts",
    description: "Collection service pricing and payout status.",
    rows: [
      { ref: "ST-0412", marker: "ST", title: "Statement · current period", meta: "USD 320.00 available", status: "Reconciliation", tone: "info", details: [{ term: "Available balance", detail: "USD 320.00" }, { term: "Pending settlement", detail: "USD 96.00" }] },
    ],
    restricted: "Refunds, reconciliation changes and manual adjustments would remain with financial officers.",
    actions: ["Download statement"],
  },
  { id: "history", title: "History", description: "Completed pickups and handoffs.", rows: pickupRows.slice(1, 2).map((row) => ({ ...row, status: "Delivered", tone: "success" as const })), restricted: collectionRestricted, actions: ["View custody events"] },
]);

/* ---------------- Collection agent ---------------- */

export const AGENT_RULES = fictional([
  "Large one-handed touch targets",
  "Minimum necessary patient information",
  "Offline event time and sync time",
  "Barcode and manual-code fallback",
  "No access to other agents’ work",
]);

export const AGENT_NEXT = fictional({
  window: "09:30–10:30",
  place: "Sinkor, Monrovia",
  ref: "Pickup PU-2084 · Patient PT-10482",
  destination: "Monrovia Central Lab",
  steps: ["Arrive", "Verify", "Collect", "Package", "Handoff"],
  after: "11:00 · Congo Town",
});

const agentRows: PreviewRow[] = [
  { ref: "PU-2084", marker: "PU", title: "09:30 · Sinkor", meta: "PU-2084 · Fictional reference", status: "Next pickup", tone: "success", details: [{ term: "Window", detail: "09:30–10:30" }, { term: "Destination", detail: "Monrovia Central Lab (fictional)" }] },
  { ref: "PU-2081", marker: "PU", title: "11:00 · Congo Town", meta: "PU-2081 · Fictional reference", status: "Assigned", tone: "info", details: [{ term: "Window", detail: "11:00–12:00" }, { term: "Details", detail: "Unlock after the current handoff" }] },
  { ref: "SYNC-08", marker: "SYN", title: "2 custody events", meta: "SYNC-08 · Fictional reference", status: "Pending sync", tone: "warning", details: [{ term: "Recorded offline", detail: "09:41 and 09:52" }, { term: "Sync", detail: "Waiting for connection" }] },
];

const agentRestricted = "Only pickups assigned to the signed-in agent would be shown.";
export const AGENT_SECTIONS = fictional<PreviewSection[]>([
  { id: "assigned-pickups", title: "Assigned pickups", description: "Complete only work assigned to the signed-in collection agent.", rows: agentRows.slice(0, 2), restricted: agentRestricted, actions: ["Start pickup"] },
  { id: "offline-queue", title: "Offline queue", description: "Events recorded without a connection, waiting to sync.", rows: agentRows.slice(2), restricted: agentRestricted, actions: ["Retry sync"] },
  { id: "handoff-history", title: "Handoff history", description: "Specimens handed to a laboratory.", rows: [{ ...agentRows[1], status: "Handed off", tone: "success" }], restricted: agentRestricted, actions: ["View receipt"] },
]);

/* ---------------- Customer support ---------------- */

export const SUPPORT_METRICS = fictional([
  { value: "24", label: "Open tickets", hint: "8 assigned to you", tone: "info" as const },
  { value: "5", label: "High priority", hint: "No clinical triage", tone: "critical" as const },
  { value: "11m", label: "First response", hint: "Current median", tone: "success" as const },
  { value: "7", label: "Follow-ups", hint: "Due today", tone: "warning" as const },
]);

const ticketRows: PreviewRow[] = [
  { ref: "T-842", marker: "T-842", title: "Unable to join consultation", meta: "APT-3084 · Patient PT-10482", status: "High", tone: "critical", details: [{ term: "User reference", detail: "PT-10482 (fictional)" }, { term: "Booking", detail: "APT-3084" }, { term: "Assigned", detail: "Support SP-07" }] },
  { ref: "T-839", marker: "T-839", title: "Payment authorization question", meta: "TX-92018 · Provider request", status: "Normal", tone: "warning", details: [{ term: "Transaction", detail: "TX-92018 (fictional)" }, { term: "Assigned", detail: "Support SP-02" }] },
  { ref: "T-836", marker: "T-836", title: "Reschedule assistance", meta: "APT-3076 · Patient request", status: "Follow-up", tone: "info", details: [{ term: "Booking", detail: "APT-3076 (fictional)" }, { term: "Assigned", detail: "Support SP-07" }] },
];

export const SUPPORT_TICKETS = fictional(ticketRows);

export const SUPPORT_THREAD = fictional([
  { time: "09:14", from: "Patient", text: "I could not enter the waiting room for my 9:00 appointment." },
  { time: "09:17", from: "Support", text: "I have confirmed the booking and am checking the appointment status. I cannot view your clinical notes." },
]);

const supportRestricted = "Clinical records, prescriptions, result release and financial adjustments would be unavailable to support.";
export const SUPPORT_SECTIONS = fictional<PreviewSection[]>([
  { id: "tickets", title: "Ticket queue", description: "Resolve service requests using minimum necessary appointment and account context.", rows: ticketRows, restricted: supportRestricted, actions: ["Open ticket", "Escalate"] },
  { id: "user-lookup", title: "User lookup", description: "Find a person’s bookings and account status without clinical detail.", rows: [{ ref: "PT-10482", marker: "PT", title: "Patient PT-10482", meta: "2 bookings · fictional", status: "Active", tone: "success", details: [{ term: "Bookings", detail: "APT-3084, APT-3076" }, { term: "Clinical information", detail: "Not available to support" }] }], restricted: supportRestricted, actions: ["View bookings"] },
  { id: "templates", title: "Templates", description: "Approved replies for common questions.", rows: [{ ref: "TPL-04", marker: "TPL", title: "Consultation access steps", meta: "Used 18 times · fictional", status: "Approved", tone: "success", details: [{ term: "Category", detail: "Appointments" }] }, { ref: "TPL-09", marker: "TPL", title: "Reschedule guidance", meta: "Used 7 times · fictional", status: "Approved", tone: "success", details: [{ term: "Category", detail: "Appointments" }] }], restricted: supportRestricted, actions: ["Use template"] },
  { id: "escalations", title: "Escalations", description: "Tickets routed to administration or finance.", rows: [ticketRows[0]], restricted: supportRestricted, actions: ["Escalate to administration"] },
  { id: "reports", title: "Reports", description: "Ticket volumes and response times.", rows: [{ ref: "RPT-11", marker: "RPT", title: "Weekly ticket summary", meta: "Current period · fictional", status: "Ready", tone: "info", details: [{ term: "Tickets", detail: "24 open" }, { term: "First response", detail: "11 minutes median" }] }], restricted: supportRestricted, actions: ["Export report"] },
]);

/* ---------------- Financial officer ---------------- */

export const FINANCE_METRICS = fictional([
  { value: "USD 18,420", label: "Authorized", hint: "Current reconciliation period", tone: "info" as const },
  { value: "USD 16,980", label: "Captured", hint: "Subject to settlement", tone: "success" as const },
  { value: "USD 1,240", label: "Pending payouts", hint: "Across provider types", tone: "warning" as const },
  { value: "6", label: "Exceptions", hint: "2 require approval", tone: "critical" as const },
]);

export type Transaction = { id: string; ref: string; amount: string; status: string; tone: BadgeTone; type: string };
export const FINANCE_TRANSACTIONS = fictional<Transaction[]>([
  { id: "TX-92018", ref: "APT-3084", amount: "USD 35.00", status: "Refund review", tone: "warning", type: "Consultation" },
  { id: "TX-92017", ref: "LAB-1042", amount: "USD 22.00", status: "Reconciled", tone: "success", type: "Laboratory" },
  { id: "TX-92014", ref: "APT-3076", amount: "USD 42.00", status: "Failed", tone: "critical", type: "Consultation" },
  { id: "TX-92009", ref: "PAY-821", amount: "USD 18.00", status: "Disputed", tone: "critical", type: "Collection" },
]);

export const FINANCE_RECIPIENTS = fictional([
  { group: "Independent doctors", count: "12 pending", status: "Reconciliation", tone: "warning" as const },
  { group: "Clinics", count: "4 pending", status: "Scheduled", tone: "info" as const },
  { group: "Laboratories", count: "3 pending", status: "Ready", tone: "success" as const },
  { group: "Collectors", count: "2 exceptions", status: "Review", tone: "critical" as const },
]);

export const FINANCE_AUDIT = fictional([
  { time: "10:02", title: "Refund review opened", actor: "Officer FO-04 · TX-92018" },
  { time: "09:36", title: "Payout exception assigned", actor: "Officer FO-02 · PAY-821" },
  { time: "08:50", title: "Reconciliation export created", actor: "Officer FO-04 · Current period" },
]);

const financeRows: PreviewRow[] = FINANCE_TRANSACTIONS.data.slice(0, 3).map((tx) => ({
  ref: tx.id,
  marker: "TX",
  title: `${tx.amount} ${tx.type.toLowerCase()}`,
  meta: `${tx.id} · Fictional reference`,
  status: tx.status,
  tone: tx.tone,
  details: [
    { term: "Booking or service", detail: tx.ref },
    { term: "Amount", detail: tx.amount },
    { term: "Type", detail: tx.type },
  ],
}));
const financeRestricted = "Clinical notes and diagnosis would not be available. Financial context is limited to the service and transaction.";
export const FINANCE_SECTIONS = fictional<PreviewSection[]>([
  { id: "transactions", title: "Transactions", description: "Review financial records and approval queues without clinical detail.", rows: financeRows, restricted: financeRestricted, actions: ["View allocation"] },
  { id: "refunds", title: "Refunds", description: "Refund requests and their approval state.", rows: [financeRows[0]], restricted: financeRestricted, actions: ["Review full refund"] },
  { id: "reconciliation", title: "Reconciliation", description: "Match captured payments to bookings and services.", rows: financeRows, restricted: financeRestricted, actions: ["Mark reconciled"] },
  { id: "payouts", title: "Payouts", description: "Payout batches by recipient type.", rows: FINANCE_RECIPIENTS.data.map((r, i) => ({ ref: `PAY-${820 + i}`, marker: "PAY", title: r.group, meta: r.count, status: r.status, tone: r.tone, details: [{ term: "Recipients", detail: r.group }, { term: "Pending", detail: r.count }] })), restricted: financeRestricted, actions: ["Approve batch"] },
  { id: "reports", title: "Reports", description: "Period summaries and exports.", rows: [{ ref: "RPT-07", marker: "RPT", title: "Reconciliation summary", meta: "Current period · fictional", status: "Ready", tone: "info", details: [{ term: "Authorized", detail: "USD 18,420" }, { term: "Captured", detail: "USD 16,980" }] }], restricted: financeRestricted, actions: ["Export report"] },
]);

/* ---------------- Specimen lifecycle (reference model, not MedNet's current flow) ---------------- */

export type LifecycleStage = { owner: string; title: string; detail: string; mednet: "supported" | "partial" | "none"; mednetNote: string };
export const LIFECYCLE_STAGES = fictional<LifecycleStage[]>([
  { owner: "Doctor", title: "Doctor order", detail: "Clinical order signed", mednet: "none", mednetNote: "Patients request tests; doctors do not order them in MedNet." },
  { owner: "Laboratory", title: "Laboratory review", detail: "Availability, fee and requirements", mednet: "none", mednetNote: "No accept or reject step." },
  { owner: "Patient / Finance", title: "Authorization", detail: "Payment or approval if required", mednet: "none", mednetNote: "Payments are out of scope." },
  { owner: "Collection provider", title: "Pickup assigned", detail: "Provider and agent scheduled", mednet: "partial", mednetNote: "An administrator assigns the request to laboratory staff; there is no collection role." },
  { owner: "Agent", title: "Specimen collected", detail: "Identity, label and packaging checks", mednet: "none", mednetNote: "Not recorded." },
  { owner: "Agent / Lab", title: "Custody transport", detail: "Every transfer timestamped", mednet: "none", mednetNote: "Not recorded." },
  { owner: "Laboratory", title: "Laboratory receipt", detail: "Condition accepted or rejected", mednet: "none", mednetNote: "Not recorded." },
  { owner: "Laboratory", title: "Test processing", detail: "Result recorded as draft", mednet: "partial", mednetNote: "The laboratory starts the order and submits a text result for doctor review." },
  { owner: "Laboratory", title: "Professional validation", detail: "Authorized release to doctor", mednet: "none", mednetNote: "No laboratory-side validation step." },
  { owner: "Doctor", title: "Clinical review", detail: "Doctor releases to patient", mednet: "supported", mednetNote: "A doctor with a care relationship and consent releases or returns the result." },
]);

export const LIFECYCLE_EXCEPTIONS = fictional([
  { title: "Order rejected", path: "Reason to doctor → revise order or select alternative laboratory" },
  { title: "Test unavailable", path: "Laboratory declines → platform or doctor reassigns" },
  { title: "Authorization incomplete", path: "Hold scheduling → notify responsible party" },
  { title: "Failed pickup", path: "Record reason → reschedule or return to coordination" },
  { title: "Unsuitable specimen", path: "Lab rejects with evidence → recollection workflow" },
  { title: "Transport delay", path: "Update ETA → lab evaluates specimen condition" },
  { title: "Delayed result", path: "Update turnaround → notify doctor and operations" },
  { title: "Corrected result", path: "Preserve original → validate addendum → notify doctor" },
]);

/** Open policy questions from the reference. Not decided by MedNet; listed, never assumed. */
export const LIFECYCLE_DEPENDENCIES = [
  "Exact payment timing for test and collection services",
  "Result-review deadline and unavailable-doctor fallback",
  "Critical-value escalation policy",
  "Recollection fee responsibility",
];

/* ---------------- Permissions matrix ---------------- */

/** The reference's proposed matrix, including roles MedNet does not have. A design proposal, not enforcement. */
export const PROPOSED_MATRIX = fictional([
  ["Patient", "Own appointments, released records, payments", "Book, pay, message", "Own details", "No", "Own records"],
  ["Doctor", "Assigned patients and encounters", "Orders, notes, prescriptions", "Own clinical drafts", "Review/release results", "Assigned records"],
  ["Laboratory", "Assigned orders and authorized context", "Result drafts, specimen events", "Processing data", "Validate/release to doctor", "Partner records"],
  ["Collection provider", "Assigned pickup minimum", "Assignments and exceptions", "Schedules", "Coordinate only", "Own operations"],
  ["Collection agent", "Own assigned pickups", "Collection and handoff events", "Own unsynced drafts", "No", "No"],
  ["Administrator", "Scoped operations", "Tasks and coordination", "Allowed operational data", "Authorized tasks only", "Scoped reports"],
  ["Super administrator", "Platform governance", "Roles and configuration", "Access policies", "High-impact governance", "Audit exports"],
  ["Support", "Minimum service context", "Tickets and notes", "Assigned tickets", "Escalate only", "Ticket history"],
  ["Financial officer", "Transactions and service references", "Reconciliation and proposals", "Financial records", "Per approval policy", "Financial reports"],
]);

/**
 * What the MedNet API enforces today (Phases 4A–4G). Factual, not fictional: kept beside the proposal so
 * the preview never implies permissions that do not exist.
 */
export const ENFORCED_TODAY: Array<[role: string, access: string]> = [
  ["Patient (PATIENT)", "Own profile, appointments, messages, requests and released results; grants and withdraws record consent."],
  ["Doctor (PROVIDER, approved application)", "Own schedule and appointments; a patient’s records, vitals and pending results only with a care relationship and the patient’s consent; releases or returns results."],
  ["Laboratory (LABORATORY)", "Requests assigned to the account: start processing, submit results for doctor review, read back its own submissions. No release."],
  ["Home care (HOME_CARE)", "Requests assigned to the account: schedule, start and complete visits."],
  ["Administrator (ADMIN)", "Provider decisions; create, suspend and reactivate non-administrator accounts; assign service requests; appointment list; audit trail. No clinical content."],
  ["Super administrator (SUPER_ADMIN)", "Everything an administrator can do, plus editing, verification, account types and deletion of any account except the configured administrator."],
  ["Collection provider, collection agent, support, financial officer", "No such roles exist. These workspaces are previews only."],
];

export const ACCESS_PRINCIPLES = [
  { title: "Relationship-aware", body: "Role alone does not grant record access. Assignment, organization, purpose and workflow state also apply." },
  { title: "Role contexts", body: "Multi-role users enter one explicit workspace at a time; permissions are not silently combined." },
  { title: "Traceable actions", body: "Approvals, exports, result release, refunds and access changes record actor, time and reason." },
  { title: "Backend enforced", body: "Hidden controls improve clarity but are never the security boundary." },
];

/* ---------------- Route lookup (plain module, usable by server routes) ---------------- */

export type PreviewWorkspaceKey = "collection" | "agent" | "support" | "finance";

export const PREVIEW_SECTION_IDS: Record<PreviewWorkspaceKey, string[]> = {
  collection: COLLECTION_SECTIONS.data.map((section) => section.id),
  agent: AGENT_SECTIONS.data.map((section) => section.id),
  support: SUPPORT_SECTIONS.data.map((section) => section.id),
  finance: FINANCE_SECTIONS.data.map((section) => section.id),
};

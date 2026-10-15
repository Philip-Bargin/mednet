import { fictional } from "@/lib/fictional";

/**
 * Presentation-only earnings for the approved "Earnings and payouts" design. MedNet takes no payments
 * and makes no payouts (AGENTS.md): no amount here relates to any real appointment or account.
 * Always rendered with <FictionalDataBadge />.
 */
export const FICTIONAL_EARNINGS = fictional([
  { label: "Available balance", value: "USD 245.00", note: "Example amount" },
  { label: "Pending settlement", value: "USD 105.00", note: "Example amount" },
  { label: "Next payout", value: "Not scheduled", note: "No payouts on MedNet" },
  { label: "Payout method", value: "None", note: "No payment details are collected" },
]);

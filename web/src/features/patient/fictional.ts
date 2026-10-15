import { fictional } from "@/lib/fictional";

/**
 * Presentation-only payment records for the approved Payments designs. MedNet has no payment
 * capability and payments are out of scope (AGENTS.md): nothing here is charged, stored or
 * linked to a real appointment. Always rendered with <FictionalDataBadge />.
 */
export type FictionalReceipt = {
  reference: string;
  amount: string;
  description: string;
  date: string;
  status: "Authorized" | "Paid" | "Pending";
};

export const FICTIONAL_RECEIPTS = fictional<FictionalReceipt[]>([
  { reference: "EX-3084", amount: "USD 35.00", description: "Text consultation (example)", date: "12 August", status: "Authorized" },
  { reference: "EX-3051", amount: "USD 30.00", description: "Follow-up consultation (example)", date: "8 August", status: "Paid" },
  { reference: "EX-1042", amount: "USD 22.00", description: "Laboratory test (example)", date: "7 August", status: "Pending" },
]);

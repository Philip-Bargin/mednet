import { fictional } from "@/lib/fictional";

/**
 * Sample data for the development showcase only. Every record is the reference prototype's own
 * fictional demonstration content ("Prototype content is fictional"). Never import outside (dev).
 */
export const sampleDoctors = fictional([
  { id: "mc", name: "Dr. Mariama Cole", specialty: "General medicine", focus: "Adult primary care", nextAvailable: "Today, 2:30 PM", fee: "USD 35" },
  { id: "sd", name: "Dr. Samuel K. Doe", specialty: "Pediatrics", focus: "Children and adolescents", nextAvailable: "Tomorrow, 9:00 AM", fee: "USD 30" },
  { id: "hm", name: "Dr. Hannah Mensah", specialty: "Women’s health", focus: "Routine and follow-up care", nextAvailable: "Tomorrow, 11:30 AM", fee: "USD 42" },
]);

export type SampleOrder = {
  id: string;
  patient: string;
  test: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CANCELLED";
  requestedBy: string;
  turnaround: string;
};

export const sampleOrders = fictional<SampleOrder[]>([
  { id: "LAB-1042", patient: "PT-10482", test: "Complete blood count", status: "OPEN", requestedBy: "Dr. M. Cole", turnaround: "24 hours" },
  { id: "LAB-1041", patient: "PT-10376", test: "Blood glucose", status: "IN_PROGRESS", requestedBy: "Dr. S. Doe", turnaround: "12 hours" },
  { id: "LAB-1038", patient: "PT-10218", test: "Lipid profile", status: "IN_PROGRESS", requestedBy: "Dr. H. Mensah", turnaround: "36 hours" },
  { id: "LAB-1033", patient: "PT-10094", test: "Urinalysis", status: "CANCELLED", requestedBy: "Dr. M. Cole", turnaround: "Reschedule" },
]);

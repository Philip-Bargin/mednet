/** Tab ids read by server pages; kept out of client modules so server code can import them. */
export const PROVIDER_APPOINTMENT_TABS = ["requests", "upcoming", "history"] as const;
export type ProviderAppointmentTab = (typeof PROVIDER_APPOINTMENT_TABS)[number];

export const PATIENT_TABS = ["records", "results", "vitals", "appointments"] as const;
export type PatientTab = (typeof PATIENT_TABS)[number];

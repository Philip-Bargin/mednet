import { apiRequest } from "@/lib/api";
import { directoryFilter } from "./specialty";

/**
 * Public provider discovery and patient appointment requests.
 * Contracts: `com.mednet.provider.api.ProviderController` (directory, public),
 * `ProviderAvailabilityController` (open future slots, public, sorted by start time) and
 * `com.mednet.appointment.api.AppointmentController` (POST is PATIENT-only).
 */

/** Spring Data `Page` as serialised by the API (only the fields the UI reads). */
export type Page<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};

/** Only approved providers are listed (FR-009). Credential verification policy is unresolved (OQ-09). */
export type DirectoryProvider = {
  id: string;
  displayName: string;
  specialty: string;
  /** Earliest open future slot, or null when none (Phase 5D; saves one availability call per provider). */
  nextAvailableAt?: string | null;
};

/** `GET /providers/specialties`: approved providers per specialty across the whole directory. */
export type SpecialtyCount = { specialty: string; providers: number };

export type ConsultationMode = "IN_PERSON" | "TEXT" | (string & {});

export type AvailabilitySlot = {
  id: string;
  startsAt: string;
  endsAt: string;
  consultationMode: ConsultationMode;
};

export type AppointmentRequestResult = {
  id: string;
  status: string;
  providerName: string;
  consultationMode: ConsultationMode;
  startsAt: string;
  endsAt: string;
};

/** Backend limit for `search` and `specialty` (ProviderService.normalizeFilter). */
export const DIRECTORY_FILTER_MAX = 120;

/** GET /providers — `search` matches name or specialty; `specialty` matches specialty. Case-insensitive substring. */
export function listProviders(
  { search, specialty, page = 0, size = 12 }: { search?: string; specialty?: string; page?: number; size?: number },
  signal?: AbortSignal,
) {
  return apiRequest<Page<DirectoryProvider>>("/providers", {
    // Spelling equivalents (Paediatrics/Pediatrics) are matched with one compatible substring filter.
    query: { search: directoryFilter(search ?? "") || undefined, specialty: directoryFilter(specialty ?? "") || undefined, page, size },
    signal,
  });
}

/** GET /providers/{id} — one approved provider (public); 404 for anyone else. */
export function getProvider(providerId: string, signal?: AbortSignal) {
  return apiRequest<DirectoryProvider>(`/providers/${encodeURIComponent(providerId)}`, { signal });
}

/** GET /providers/specialties — most providers first. */
export function listSpecialties(signal?: AbortSignal) {
  return apiRequest<SpecialtyCount[]>("/providers/specialties", { signal });
}

/** GET /providers/{id}/availability — open, future slots, earliest first. 404 when the provider is not approved. */
export function listAvailability(providerId: string, { page = 0, size = 25 } = {}, signal?: AbortSignal) {
  return apiRequest<Page<AvailabilitySlot>>(`/providers/${encodeURIComponent(providerId)}/availability`, {
    query: { page, size },
    signal,
  });
}

/**
 * POST /appointments — a request the provider must confirm. 409 when the patient profile is
 * incomplete or the slot was taken; 403 for non-patient accounts.
 */
export function requestAppointment(availabilitySlotId: string) {
  return apiRequest<AppointmentRequestResult>("/appointments", {
    method: "POST",
    body: { availabilitySlotId },
  });
}

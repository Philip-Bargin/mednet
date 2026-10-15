/**
 * Presentation-only data convention.
 *
 * Screens whose design is approved but whose backend does not exist yet (payments,
 * payouts, collection, support, finance, parts of laboratory) may render fictional
 * records so the interface can be reviewed. Such data:
 * - lives in `src/features/<domain>/fictional.ts`, never mixed into API modules;
 * - is wrapped with `fictional()` so the source is explicit at the call site;
 * - must be displayed with `<FictionalDataBadge />`.
 * It must never be presented as a completed integration.
 */
export type Fictional<T> = { readonly source: "fictional"; readonly data: T };

export function fictional<T>(data: T): Fictional<T> {
  return { source: "fictional", data };
}

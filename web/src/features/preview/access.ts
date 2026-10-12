/**
 * Preview workspaces (Phase 4G) show approved designs for roles MedNet does not have yet, with
 * fictional data only. They are served in development and test builds; a production deployment
 * serves them only when `MEDNET_PREVIEW_WORKSPACES=enabled` is set as an explicit deployment decision.
 * Read at request time (the preview layout is dynamic), so the flag needs no rebuild.
 */
export function previewsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV !== "production" || env.MEDNET_PREVIEW_WORKSPACES === "enabled";
}

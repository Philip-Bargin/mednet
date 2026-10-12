import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
/** Point at an already-running server (for example a production build behind a local edge proxy). */
const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
/** `*.live.spec.ts` drive a real MedNet API and only run when this is set (see e2e/README.md). */
const liveApi = process.env.MEDNET_LIVE_API === "1";

/**
 * Browser checks for layouts and responsive behaviour. Uses an installed browser channel
 * (default: Microsoft Edge) so no browser download is required; set PLAYWRIGHT_CHANNEL
 * to "chrome", or unset it after `npx playwright install chromium`.
 * The dev server is used because /foundation preview routes are development-only.
 */
export default defineConfig({
  testDir: "./e2e",
  testIgnore: liveApi ? [] : ["**/*.live.spec.ts"],
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: externalBaseUrl ?? `http://localhost:${port}`,
    channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge",
  },
  projects: [
    { name: "compact", use: { ...devices["Desktop Edge"], viewport: { width: 390, height: 844 } } },
    { name: "medium", use: { ...devices["Desktop Edge"], viewport: { width: 820, height: 1180 } } },
    { name: "wide", use: { ...devices["Desktop Edge"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: `npx next dev --port ${port}`,
        url: `http://localhost:${port}/foundation`,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { previewsEnabled } from "./access";
import { PREVIEW_SECTION_IDS } from "./fixtures";
import { WORKSPACES } from "@/features/workspace/workspaces";

describe("preview access", () => {
  it("is on in development and test, off in production unless explicitly enabled", () => {
    expect(previewsEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(previewsEnabled({ NODE_ENV: "test" })).toBe(true);
    expect(previewsEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(previewsEnabled({ NODE_ENV: "production", MEDNET_PREVIEW_WORKSPACES: "true" })).toBe(false);
    expect(previewsEnabled({ NODE_ENV: "production", MEDNET_PREVIEW_WORKSPACES: "enabled" })).toBe(true);
  });

  it("never touches the API or browser storage", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts")) files.push(full);
      }
    };
    walk(path.join(process.cwd(), "src/features/preview"));
    walk(path.join(process.cwd(), "src/app/(preview)"));
    expect(files.length).toBeGreaterThan(10);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/@\/lib\/api|apiRequest|fetch\(|getSession|localStorage|sessionStorage|indexedDB/);
    }
  });

  it("has a route for every menu item", () => {
    const keys = { "collection-provider": "collection", "collection-agent": "agent", support: "support", finance: "finance" } as const;
    for (const [workspaceId, key] of Object.entries(keys)) {
      const workspace = WORKSPACES[workspaceId as keyof typeof keys];
      const sections = workspace.items.filter((item) => item.href !== workspace.basePath).map((item) => item.href.split("/").at(-1));
      expect(sections).toEqual(PREVIEW_SECTION_IDS[key]);
    }
  });
});

/** The old login address `/admin/login` (the dashboard at /admin is tested in Dashboard.test.tsx). Requirements: FR-30, FR-42.
 * Since 2026-10-26 there is one login, `/log-in`, and the old address redirects to it so old bookmarks and links still work
 * (a permanent redirect, made by the host before any page code runs). Nothing in the site sends a person to the old address.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

import { readSource } from "../helpers/source";

const SRC = join(process.cwd(), "src");

function sourceFilesUnder(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) return sourceFilesUnder(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

describe("/admin/login", () => {
  it("redirects to /log-in with a permanent redirect", async () => {
    const redirects = (await nextConfig.redirects?.()) ?? [];

    expect(redirects).toContainEqual({ source: "/admin/login", destination: "/log-in", permanent: true });
  });

  it("has no page of its own any more, so the redirect is the only answer", () => {
    expect(existsSync(join(SRC, "app", "(dashboards)", "admin", "login", "page.tsx"))).toBe(false);
    expect(existsSync(join(SRC, "app", "(dashboards)", "log-in", "page.tsx"))).toBe(true);
  });

  it("is sent to nobody by the site itself: the staff screens go to /log-in when there is no session", () => {
    const sendsThere = sourceFilesUnder(SRC).filter((file) => /["'`]\/admin\/login["'`]/.test(readFileSync(file, "utf8")));

    expect(sendsThere).toEqual([]);
    expect(readSource("components/admin/StaffGate.tsx")).toMatch(/router\.replace\("\/log-in"\)/);
  });

  it("is not in the footer or the header: the header links to /log-in", () => {
    expect(readSource("config/site.ts")).not.toMatch(/admin/);
  });
});

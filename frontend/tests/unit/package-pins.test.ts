/** Tests for the map packages in package.json. Requirement: FR-07. Decision 1 in specs/2026-10-11-map-view/requirements.md.
 *
 * The owner approved Leaflet 1.x at the latest stable version, pinned exactly, and no react-leaflet: we call Leaflet
 * directly in one component. A "^" or "~" range would let a new install pick another version than the one we tested.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type PackageJson = { dependencies: Record<string, string>; devDependencies: Record<string, string> };

function readFrontendFile(fileName: string): string {
  return readFileSync(join(process.cwd(), fileName), "utf8");
}

const packageJson = JSON.parse(readFrontendFile("package.json")) as PackageJson;
const EXACT_VERSION = /^\d+\.\d+\.\d+$/;

describe("the map packages", () => {
  it("pin leaflet to one exact 1.x version, with no ^ or ~", () => {
    const version = packageJson.dependencies["leaflet"];

    expect(version).toMatch(EXACT_VERSION);
    expect(version.startsWith("1.")).toBe(true); // Leaflet 2 is still an alpha
  });

  it("pin @types/leaflet to one exact version, with no ^ or ~", () => {
    expect(packageJson.devDependencies["@types/leaflet"]).toMatch(EXACT_VERSION);
  });

  it("do not include react-leaflet, in package.json or in the lock file", () => {
    const names = [...Object.keys(packageJson.dependencies), ...Object.keys(packageJson.devDependencies)];
    const lockFile = readFrontendFile("package-lock.json");

    expect(names).not.toContain("react-leaflet");
    expect(lockFile).not.toContain("react-leaflet");
    expect(lockFile).not.toContain("@react-leaflet/core");
  });
});

/** Guards the layers. Requirement: CLAUDE.md, "Project structure and layers" (API calls only via lib/api/).
 *
 * No file outside src/lib/api/ may call fetch, so every request goes through one place with the time limits and the
 * errors of lib/api/request.ts.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = fileURLToPath(new URL("../../src", import.meta.url));

function sourceFiles(folder: string): string[] {
  return readdirSync(folder).flatMap((entry) => {
    const path = join(folder, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}

describe("the API boundary", () => {
  it("no code outside lib/api calls fetch", () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => !relative(SRC, file).startsWith(`lib${sep}api${sep}`))
      .filter((file) => /\bfetch\s*\(/.test(readFileSync(file, "utf8")))
      .map((file) => relative(SRC, file));

    expect(offenders).toEqual([]);
  });

  it("the folder has files to check (the scan itself works)", () => {
    expect(sourceFiles(SRC).length).toBeGreaterThan(5);
  });

  it("no source file writes to the console (a position or an error detail must not leak)", () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => /\bconsole\.(log|info|debug|warn|error)\s*\(/.test(readFileSync(file, "utf8")))
      .map((file) => relative(SRC, file));

    expect(offenders).toEqual([]);
  });
});

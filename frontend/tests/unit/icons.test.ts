/** Guards how icons are used. Owner's decision, 2026-10-09 (UI spec, "Accessibility and performance"): lucide-react,
 * pinned to an exact version, one icon per import, decorative, always beside a text label. Requirements: NFR-01, NFR-10.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const FRONTEND = fileURLToPath(new URL("../..", import.meta.url));
const SRC = join(FRONTEND, "src");
const WRAPPER = join("components", "ui", "DecorativeIcon.tsx");

function sourceFiles(folder: string): string[] {
  return readdirSync(folder).flatMap((entry) => {
    const path = join(folder, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}

/** Every `import ... from "lucide-react"` in the source, with the part between `import` and `from`. */
function lucideImports() {
  return sourceFiles(SRC).flatMap((file) => {
    const text = readFileSync(file, "utf8");
    return [...text.matchAll(/^\s*import\s+([^;]*?)\s+from\s+["']lucide-react[^"']*["']/gms)].map((match) => ({
      file: relative(SRC, file),
      clause: match[1],
      text,
    }));
  });
}

describe("lucide-react", () => {
  it("is pinned to an exact version, with no ^ or ~", () => {
    const packageJson = JSON.parse(readFileSync(join(FRONTEND, "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };
    expect(packageJson.dependencies["lucide-react"]).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("is imported only by name, one icon at a time (never the whole set, a namespace or a default)", () => {
    const imports = lucideImports();
    expect(imports.length).toBeGreaterThan(0); // the scan finds the imports
    for (const { file, clause } of imports) {
      expect(clause, file).toMatch(/^(type\s+)?\{[^}]+\}$/); // import { Phone } or import type { LucideIcon }
      expect(clause, file).not.toMatch(/\*|\bdefault\b/);
    }
  });

  it("is not loaded in any other way (no require, no dynamic import, no DynamicIcon, no icons table)", () => {
    const offenders = sourceFiles(SRC)
      .filter((file) =>
        /require\(["']lucide-react|import\(["']lucide-react|DynamicIcon|lucide-react\/dynamic|\bicons\[/.test(
          readFileSync(file, "utf8"),
        ),
      )
      .map((file) => relative(SRC, file));
    expect(offenders).toEqual([]);
  });

  it("is drawn through DecorativeIcon, so every icon is hidden from screen readers", () => {
    const offenders = lucideImports()
      .filter(({ file, clause }) => file !== WRAPPER && !clause.startsWith("type"))
      .filter(({ text }) => !text.includes("DecorativeIcon"))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});

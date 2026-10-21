/** The icons that make the site installable. Requirements: NFR-03 ("installable web app"), NFR-04. Decision A9 in
 * specs/2026-10-17-swiftrescue/requirements.md. Chrome offers "Install" when the manifest has a 192 px and a 512 px PNG icon.
 */
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";

/** Width and height from the header of a PNG file (bytes 16 to 24). */
function pngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a"); // the PNG signature
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe("the manifest icons", () => {
  const icons = manifest().icons ?? [];

  it("lists a 192 px and a 512 px PNG icon", () => {
    expect(icons.map((icon) => icon.sizes).sort()).toEqual(["192x192", "512x512"]);
    expect(icons.every((icon) => icon.type === "image/png")).toBe(true);
  });

  it.each([192, 512])("the %i px file exists, is a PNG of exactly that size, and is small", (size) => {
    const icon = icons.find((entry) => entry.sizes === `${size}x${size}`);
    expect(icon).toBeDefined();
    const path = join(process.cwd(), "public", (icon?.src ?? "").replace(/^\//, ""));

    expect(pngSize(path)).toEqual({ width: size, height: size });
    expect(statSync(path).size).toBeLessThan(20_000); // NFR-01: nothing heavy
  });
});

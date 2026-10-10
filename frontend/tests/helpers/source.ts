/** Reads a file of src/ as text. Tests run from the frontend folder, so this works in the jsdom tests too
 * (`new URL(..., import.meta.url)` does not: jsdom replaces the URL class with one that only knows web addresses).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function readSource(pathInsideSrc: string): string {
  return readFileSync(join(process.cwd(), "src", pathInsideSrc), "utf8");
}

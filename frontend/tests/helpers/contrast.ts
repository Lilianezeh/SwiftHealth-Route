/** Colour maths for the tests: the WCAG contrast ratio between two colours, and what a colour looks like laid over another one
 * at a given opacity (used for the dark overlay on the home page hero, whatever photo is under it). Colours are "#rrggbb".
 * The formula is the WCAG 2 relative luminance and contrast ratio.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function luminance(hex: string): number {
  const [red, green, blue] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const linear = (channel: number) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

/** WCAG contrast ratio between two colours (1 to 21). */
export function contrast(first: string, second: string): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

/** The colour of `top` laid over `bottom` at `opacity` (0 to 1). */
export function laidOver(top: string, bottom: string, opacity: number): string {
  const channels = [1, 3, 5].map((start) => {
    const upper = parseInt(top.slice(start, start + 2), 16);
    const lower = parseInt(bottom.slice(start, start + 2), 16);
    return Math.round(upper * opacity + lower * (1 - opacity));
  });
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

/** The value of a colour token in the dark block of globals.css (`:root[data-theme="dark"]`), for example `darkTokenColour("veil")`. */
export function darkTokenColour(name: string): string {
  const css = readFileSync(join(process.cwd(), "src", "styles", "globals.css"), "utf8");
  const block = css.match(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/)?.[1] ?? "";
  const match = block.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`colour token ${name} not found in the dark block of globals.css`);
  return match[1].toLowerCase();
}

/** The value of a colour token of globals.css (its light value), for example `tokenColour("pine-dark")` is "#134f6a". */
export function tokenColour(name: string): string {
  const css = readFileSync(join(process.cwd(), "src", "styles", "globals.css"), "utf8");
  const match = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`colour token ${name} not found in globals.css`);
  return match[1].toLowerCase();
}

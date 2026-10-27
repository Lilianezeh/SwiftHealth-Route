/** Classes for the buttons, shared by links and buttons. UI spec: "Buttons and text". Requirement: NFR-10.
 * At least 50 px high (never under 48 px), 16 px text, colours from the design tokens.
 */
export type ButtonVariant = "primary" | "secondary" | "onDark" | "whatsapp" | "emergency";

const BASE = "w-full items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold";
const HEIGHT = "min-h-[50px]";
const LARGE_HEIGHT = "min-h-14"; // 56 px: Call and WhatsApp in the main row of the listing page, level with each other (spec D1)

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-pine text-white hover:bg-pine-dark active:bg-pine-dark",
  // The edge goes darker on hover in the light mode; in the dark mode the dark blue would vanish on a dark card, so it goes light (`dark:`).
  secondary:
    "border border-pine bg-surface text-forest hover:border-pine-dark hover:bg-pine-50 active:border-pine-dark active:bg-pine-100 dark:hover:border-forest dark:active:border-forest",
  // The home page hero: the pine button would vanish on the dark gradient, so this one is white (`snow`, a white that stays white in the
  // dark mode too, like the hero) with dark blue text (8.9:1), and a pale blue on hover and press.
  onDark: "bg-snow text-pine-dark hover:bg-sky-pale active:bg-sky-pale",
  // The WhatsApp button of the listing page (owner's Option A, 2026-10-13): a card surface, a dark green border (the whatsapp-dark token,
  // 7.67:1 on white), ink text (15.83:1), the light green of "Open now" on hover. The bright green is in the glyph (WhatsApp's own file),
  // never a white label on green (1.98:1).
  whatsapp: "border-2 border-whatsapp-dark bg-surface text-ink hover:bg-open-bg active:bg-open-bg",
  emergency: "bg-emergency text-white", // SwiftRescue only (UI spec: Buttons and text)
};

export function buttonClasses(variant: ButtonVariant, options: { large?: boolean } = {}): string {
  return `inline-flex ${options.large ? LARGE_HEIGHT : HEIGHT} ${BASE} ${VARIANTS[variant]}`;
}

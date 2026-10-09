/** Classes for the buttons, shared by links and buttons. UI spec: "Buttons and text". Requirement: NFR-10.
 * At least 50 px high (never under 48 px), 16 px text, colours from the design tokens.
 */
export type ButtonVariant = "primary" | "secondary";

const BASE = "inline-flex min-h-[50px] w-full items-center justify-center rounded-xl px-4 text-base font-semibold";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-pine text-white",
  secondary: "border border-pine bg-white text-forest",
};

export function buttonClasses(variant: ButtonVariant): string {
  return `${BASE} ${VARIANTS[variant]}`;
}

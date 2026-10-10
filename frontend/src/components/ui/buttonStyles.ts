/** Classes for the buttons, shared by links and buttons. UI spec: "Buttons and text". Requirement: NFR-10.
 * At least 50 px high (never under 48 px), 16 px text, colours from the design tokens.
 */
export type ButtonVariant = "primary" | "secondary" | "emergency";

const BASE =
  "inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-pine text-white hover:bg-pine-dark active:bg-pine-dark",
  secondary:
    "border border-pine bg-white text-forest hover:border-pine-dark hover:bg-pine-50 active:border-pine-dark active:bg-pine-100",
  emergency: "bg-emergency text-white", // SwiftRescue only (UI spec: Buttons and text)
};

export function buttonClasses(variant: ButtonVariant): string {
  return `${BASE} ${VARIANTS[variant]}`;
}

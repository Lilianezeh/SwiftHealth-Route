"use client";

/** The one password field of the site, with an eye button to show or hide what was typed. Requirements: NFR-06, NFR-10, US-13.
 * Owner's request of 2026-10-25: the staff login, the Security screen, the staff accounts screen, and the sign-up, change-password and
 * reset-password screens to come all use this component, so they all behave the same.
 *
 * - The caller keeps its own `<label htmlFor={id}>`; this draws the field and the button inside its right edge.
 * - The button is a real button (`type="button"`: it never submits the form), with `aria-label` "Show password" / "Hide password" and
 *   `aria-pressed`. It is 48 px wide and as high as the field (at least 48 px), the icon is 20 px and decoration only.
 * - Showing the password only changes the `type` of the same input (never a second input), so the caret, a paste and the browser's
 *   password manager keep working; `autocomplete` is set by the caller ("current-password" or "new-password") and never changes.
 *   The keyboard's guesses (capital letter, autocorrect, spell check) are off, so a shown password is not altered or sent to a dictionary.
 * - The password goes back to hidden when the form is submitted and when the page is left (`pagehide`, which also fires when the browser
 *   keeps the page for the back button). A new draw of the field (another page or step) starts hidden.
 * Colours are the design tokens (blue palette), so a dark mode will change them in one place.
 */
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { DecorativeIcon } from "@/components/ui/DecorativeIcon";

type PasswordFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  required?: boolean;
  name?: string;
};

export function PasswordField({ id, value, onChange, autoComplete, required, name }: PasswordFieldProps) {
  const [shown, setShown] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const hide = () => setShown(false);
    const form = input.current?.form;
    form?.addEventListener("submit", hide); // a native listener: it also runs when the form's own handler stops the submit
    window.addEventListener("pagehide", hide);
    return () => {
      form?.removeEventListener("submit", hide);
      window.removeEventListener("pagehide", hide);
    };
  }, []);

  return (
    <div className="relative">
      <input
        ref={input}
        id={id}
        name={name}
        type={shown ? "text" : "password"}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 w-full rounded-xl border border-line bg-surface pl-3 pr-14 text-base text-ink"
      />
      <button
        type="button"
        onClick={() => setShown((before) => !before)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        className="absolute inset-y-0 right-0 inline-flex min-h-12 w-12 items-center justify-center rounded-xl text-forest hover:text-pine-dark"
      >
        <DecorativeIcon icon={shown ? EyeOff : Eye} className="h-5 w-5" />
      </button>
    </div>
  );
}

"use client";

/** The Theme button: Light, Dark, System. Requirements: NFR-10, NFR-04, FR-02. Spec: specs/frontend/ui-spec.md, "Dark mode".
 * One button that goes to the next choice each time it is pressed (Light, then Dark, then System) and applies it at once. It shows
 * the choice it is on with an icon (a sun, a moon, a screen) and says it in words: in the bar from tablet width it is an icon with a
 * name ("Colour theme: Light. Change to Dark."); in the phone Menu it is a row with the words "Theme: Light". A polite live
 * region (no `role="status"`: the page's own status messages stay the only ones) tells a screen reader the new choice. The first
 * render is Light whatever is kept, so the server's page and the browser's agree; the kept choice is read once the page is drawn.
 * Everyone starts on Light, even on a dark device, until the owner approves the dark mode. The choice is kept in the browser (lib/theme/theme.ts).
 */
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { DecorativeIcon } from "@/components/ui/DecorativeIcon";
import { applyTheme, nextChoice, readChoice, saveChoice, type ThemeChoice } from "@/lib/theme/theme";

const WORDS: Record<ThemeChoice, string> = { light: "Light", dark: "Dark", system: "System" };
const ICONS: Record<ThemeChoice, LucideIcon> = { light: Sun, dark: Moon, system: Monitor };

type ThemeToggleProps = { variant: "bar" | "menu" };

export function ThemeToggle({ variant }: ThemeToggleProps) {
  const [choice, setChoice] = useState<ThemeChoice>("light");
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    setChoice(readChoice());
  }, []);

  function change() {
    const next = nextChoice(choice);
    saveChoice(next);
    applyTheme(next);
    setChoice(next);
    setAnnouncement(`Theme: ${WORDS[next]}`);
  }

  return (
    <>
      {variant === "bar" ? (
        <button
          type="button"
          onClick={change}
          aria-label={`Colour theme: ${WORDS[choice]}. Change to ${WORDS[nextChoice(choice)]}.`}
          className="hidden min-h-12 min-w-12 items-center justify-center rounded-md hover:underline md:inline-flex"
        >
          <DecorativeIcon icon={ICONS[choice]} className="h-6 w-6" />
        </button>
      ) : (
        <button type="button" onClick={change} className="inline-flex min-h-12 w-full items-center gap-3 text-base font-semibold">
          <DecorativeIcon icon={ICONS[choice]} className="h-6 w-6" />
          {`Theme: ${WORDS[choice]}`}
        </button>
      )}
      {/* A live region without role="status": the pages have their own status messages, and a second "status" in the header would
          be a second thing for a screen reader and for every test that looks for the page's one. */}
      <span aria-live="polite" className="sr-only" data-theme-announcement="">
        {announcement}
      </span>
    </>
  );
}

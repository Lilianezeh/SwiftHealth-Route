"use client";

/** The warning before an automatic sign-out. Requirements: NFR-06, NFR-10 (WCAG 2.2.1 Timing Adjustable). Spec:
 * specs/2026-10-29-idle-sign-out/. Drawn once by the root layout. Nothing is drawn (and nothing is listened to) unless someone is
 * logged in; 60 seconds before the end it shows an alert dialog, "Are you still there?" / "You'll be signed out in 60 seconds",
 * with one large button, "Stay signed in", which gets the focus. The countdown changes the text every second but is not a live
 * region (a screen reader reads the dialog once, when it opens, not 60 times). The logic is in hooks/useIdleSignOut.ts.
 */
import { useEffect, useRef } from "react";

import { buttonClasses } from "@/components/ui/buttonStyles";
import { useIdleSignOut } from "@/hooks/useIdleSignOut";

function secondsText(seconds: number): string {
  return `You'll be signed out in ${seconds} ${seconds === 1 ? "second" : "seconds"}`;
}

export function IdleSignOut() {
  const { secondsLeft, stay } = useIdleSignOut();
  const button = useRef<HTMLButtonElement>(null);
  const visible = secondsLeft !== null;

  useEffect(() => {
    if (!visible) return;
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    button.current?.focus();
    return () => before?.focus?.(); // back to where the person was
  }, [visible]);

  if (secondsLeft === null) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="idle-title"
        aria-describedby="idle-countdown"
        className="flex w-full max-w-md flex-col gap-4 rounded-lg bg-surface p-6 text-ink shadow-xl"
        onKeyDown={(event) => {
          if (event.key === "Tab") {
            event.preventDefault(); // the one button is the only place to be
            button.current?.focus();
          }
        }}
      >
        <h2 id="idle-title" className="text-xl font-bold text-forest">Are you still there?</h2>
        <p id="idle-countdown" aria-live="off" className="text-base">{secondsText(secondsLeft)}</p>
        <button
          ref={button}
          type="button"
          onClick={stay}
          className={buttonClasses("primary")}
        >
          Stay signed in
        </button>
      </div>
    </div>
  );
}

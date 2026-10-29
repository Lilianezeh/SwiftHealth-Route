"use client";

/** The sentence on the login page after an automatic sign-out. Requirements: NFR-06, NFR-10. Spec: specs/2026-10-29-idle-sign-out/.
 * The idle sign-out (hooks/useIdleSignOut.ts) sends the person to `/log-in?signed-out=idle`. This says why, as a polite status.
 * The address is read after the first draw (like the login form does), so the server and the browser draw the same page first.
 */
import { useEffect, useState } from "react";

import { IDLE_SIGNED_OUT_MESSAGE, IDLE_SIGNED_OUT_PARAM, IDLE_SIGNED_OUT_VALUE } from "@/config/idle";

export function SignedOutNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(new URLSearchParams(window.location.search).get(IDLE_SIGNED_OUT_PARAM) === IDLE_SIGNED_OUT_VALUE);
  }, []);

  if (!show) return null;
  return (
    <p role="status" className="mx-auto max-w-md px-4 pt-6 text-base font-semibold text-ink">
      {IDLE_SIGNED_OUT_MESSAGE}
    </p>
  );
}

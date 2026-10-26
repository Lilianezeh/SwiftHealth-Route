"use client";

/** Is sign-up open? For the "Sign up" links only (the header, the Menu, the login page). Requirements: FR-48, FR-02, NFR-01.
 * It reads `signup_open` of GET /meta (api-spec section 3), which `getMeta` keeps, so all the links of a page cost one request.
 * It is false until the answer is in and stays false when the call fails (the API asleep or down): a link to a page that cannot
 * work is worse than no link, and "Log in" never depends on this. Nothing is stored in the browser.
 */
import { useEffect, useState } from "react";

import { getMeta } from "@/lib/api/meta";

export function useSignupOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    getMeta()
      .then((meta) => {
        if (isCurrent) setOpen(meta.signup_open === true);
      })
      .catch(() => {
        // closed: no link
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  return open;
}

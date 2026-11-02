"use client";

/** The install card of the home page: shown once, dismissible, in the flow of the page (it covers nothing). Requirements: NFR-03, NFR-04,
 * NFR-10. UI spec 2.1; spec: specs/2026-11-02-installable-pwa/. It shows only when the site can be installed: "Install app" and "Not now" where
 * the browser offers it, or "Tap Share, then Add to Home Screen" and "Not now" on iPhone Safari. Never when the app is installed or the
 * browser cannot. "Not now" is kept in the browser's local storage (lib/pwa/installDismissed.ts, in a try/catch); until that is read the card is not drawn,
 * so it never flashes. It sits at the end of the page, above the footer, so its late arrival moves nothing the visitor was reading.
 * Tokens only (surface, line, ink, forest): Light and Dark follow the theme. One column on a phone.
 */
import { useEffect, useState } from "react";

import { buttonClasses } from "@/components/ui/buttonStyles";
import { brand } from "@/config/brand";
import { readBannerDismissed, saveBannerDismissed } from "@/lib/pwa/installDismissed";
import { promptInstall, useInstallOffer } from "@/lib/pwa/installPrompt";

export function InstallBanner() {
  const offer = useInstallOffer();
  const [dismissed, setDismissed] = useState(true); // true until the choice kept in the browser has been read
  useEffect(() => setDismissed(readBannerDismissed()), []);

  if (offer === "none" || dismissed) return null;

  function notNow() {
    saveBannerDismissed();
    setDismissed(true);
  }

  return (
    <section aria-label="Install the app" className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
        <p className="text-lg font-bold text-forest">{`Install ${brand.name}`}</p>
        <p className="text-base text-ink">
          {offer === "prompt"
            ? `Open it from your home screen like any app, and reach ${brand.emergencyName} in one tap.`
            : "To install it on your iPhone: Tap Share, then Add to Home Screen."}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {offer === "prompt" && (
            <button type="button" onClick={() => void promptInstall()} className={buttonClasses("primary")}>
              Install app
            </button>
          )}
          <button type="button" onClick={notNow} className={buttonClasses("secondary")}>
            Not now
          </button>
        </div>
      </div>
    </section>
  );
}

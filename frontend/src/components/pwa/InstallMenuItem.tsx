"use client";

/** The install row of the phone Menu. Requirements: NFR-03, NFR-04, NFR-10. Spec: specs/2026-11-02-installable-pwa/.
 * "Install app" (a 48 px row, like the links) when the browser can install the site; on iPhone Safari, the words "Tap Share, then Add
 * to Home Screen" instead (there is no button that can do it); nothing when the app is installed or the browser cannot. The Menu
 * closes when the button is tapped, so the browser's own dialog is not hidden behind it. It is never subject to the home page card's "Not now".
 */
import { promptInstall, useInstallOffer } from "@/lib/pwa/installPrompt";

type InstallMenuItemProps = { onDone: () => void };

export function InstallMenuItem({ onDone }: InstallMenuItemProps) {
  const offer = useInstallOffer();
  if (offer === "none") return null;
  if (offer === "ios") {
    return (
      <li>
        <p className="py-3 text-base">Install the app: Tap Share, then Add to Home Screen.</p>
      </li>
    );
  }
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          const asking = promptInstall(); // the browser's dialog; the event is used once
          onDone();
          void asking;
        }}
        className="inline-flex min-h-12 w-full items-center text-left text-base font-semibold"
      >
        Install app
      </button>
    </li>
  );
}

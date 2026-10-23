"use client";

/** Registers the service worker that keeps SwiftRescue and Find blood for offline use. Requirements: FR-17, NFR-03.
 * Decision A6 in specs/2026-10-17-swiftrescue/requirements.md; N6 and N7 in specs/2026-10-22-blood-offline/requirements.md.
 * It draws nothing. `pagePath` is the page it is placed on ("/emergency" or "/blood").
 *
 * Only in a production build: a development server's file names change all the time and a stale kept copy would confuse. After
 * the worker is ready, the page tells it which files of this site it loaded and its own address, so the first visit is enough
 * (the worker starts after the page has loaded, so it did not see them). Only addresses of this site are sent.
 */
import { useEffect } from "react";

import { EMERGENCY_PHOTOS } from "@/config/sitePhotos";

type RegisterServiceWorkerProps = { pagePath?: "/emergency" | "/blood" };

export function RegisterServiceWorker({ pagePath = "/emergency" }: RegisterServiceWorkerProps) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator) || !navigator.serviceWorker) return;
    const serviceWorker = navigator.serviceWorker;

    serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(() => serviceWorker.ready)
      .then((registration) => {
        const loaded = performance
          .getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter((address) => address.startsWith(`${window.location.origin}/`));
        // The two SwiftRescue photos are lazy and may not have loaded yet, so the page names them (only on SwiftRescue).
        const photos = pagePath === "/emergency" ? Object.values(EMERGENCY_PHOTOS).map((photo) => `${window.location.origin}${photo.src}`) : [];
        registration.active?.postMessage({ type: "keep-urls", urls: [`${window.location.origin}${pagePath}`, ...photos, ...loaded] });
      })
      .catch(() => {
        // no worker: the page works as before, it just cannot be opened offline
      });
  }, [pagePath]);

  return null;
}

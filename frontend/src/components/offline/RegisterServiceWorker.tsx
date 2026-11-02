"use client";

/** Registers the service worker on every public page, and shows "A new version is available — Refresh" when there is one.
 * Requirements: FR-17, NFR-03, NFR-04, NFR-10. Decision A6 in specs/2026-10-17-swiftrescue/requirements.md; N6 and N7 in
 * specs/2026-10-22-blood-offline/requirements.md; specs/2026-11-02-installable-pwa/. Placed by the layouts of the public pages (through
 * components/pwa/PublicPwa.tsx), not by the pages themselves.
 *
 * Only in a production build: a development server's file names change all the time and a stale kept copy would confuse.
 * - On SwiftRescue and Find blood (the two pages the worker keeps) the page tells the worker which files of this site it loaded, once the
 *   worker is ready, so the first visit is enough (the worker starts after the page has loaded, so it did not see them). On every other
 *   page it sends nothing. Only addresses of this site are sent.
 * - A new version of the worker does not take over by itself: it waits. The page then shows a small message at the bottom of the screen.
 *   "Refresh" tells the waiting worker to take over and reloads the page once it has; "Later" hides the message until the next page load.
 *   The very first worker of a visitor is not an update (nothing old to replace), so it shows nothing.
 * - When the visitor comes back to the page, the browser is asked to look for a new version, so a page left open for days finds out.
 * The message is drawn with tokens only (surface, line, ink), 16 px, buttons of 50 px, in one column on a phone.
 */
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { buttonClasses } from "@/components/ui/buttonStyles";
import { EMERGENCY_PHOTOS } from "@/config/sitePhotos";
import { reloadPage } from "@/lib/pwa/reloadPage";

const KEPT_PAGES = ["/emergency", "/blood"];

function isProductionWithServiceWorkers(): boolean {
  return process.env.NODE_ENV === "production" && "serviceWorker" in navigator && Boolean(navigator.serviceWorker);
}

export function RegisterServiceWorker() {
  const pathname = usePathname();
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [later, setLater] = useState(false);
  const refreshAsked = useRef(false);

  // Register once, and watch for a new version.
  useEffect(() => {
    if (!isProductionWithServiceWorkers()) return;
    const container = navigator.serviceWorker;
    let stopped = false;
    let reloaded = false;
    let stopWatching = () => {};

    // The new worker took over: reload, but only if this page asked for it (Refresh), and only once.
    const onControllerChange = () => {
      if (!refreshAsked.current || reloaded) return;
      reloaded = true;
      reloadPage();
    };
    container.addEventListener("controllerchange", onControllerChange);

    container
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        if (stopped) return;
        // A new version that was already waiting when the page opened. Only if a worker controls the page: otherwise this is the first visit.
        if (registration.waiting && container.controller) setWaitingWorker(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && container.controller) setWaitingWorker(registration.waiting ?? installing);
          });
        });
        const lookForNewVersion = () => {
          if (document.visibilityState === "visible") registration.update().catch(() => undefined);
        };
        document.addEventListener("visibilitychange", lookForNewVersion);
        stopWatching = () => document.removeEventListener("visibilitychange", lookForNewVersion);
      })
      .catch(() => {
        // no worker: the page works as before, it just cannot be opened offline
      });

    return () => {
      stopped = true;
      stopWatching();
      container.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  // On the two pages the worker keeps: tell it what this visit loaded.
  useEffect(() => {
    if (!isProductionWithServiceWorkers() || !KEPT_PAGES.includes(pathname)) return;
    navigator.serviceWorker.ready
      .then((registration) => {
        const loaded = performance
          .getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter((address) => address.startsWith(`${window.location.origin}/`));
        // The two SwiftRescue photos are lazy and may not have loaded yet, so the page names them (only on SwiftRescue).
        const photos = pathname === "/emergency" ? Object.values(EMERGENCY_PHOTOS).map((photo) => `${window.location.origin}${photo.src}`) : [];
        registration.active?.postMessage({ type: "keep-urls", urls: [`${window.location.origin}${pathname}`, ...photos, ...loaded] });
      })
      .catch(() => {
        // nothing to tell
      });
  }, [pathname]);

  function refresh() {
    if (!waitingWorker) return;
    refreshAsked.current = true;
    waitingWorker.postMessage({ type: "skip-waiting" }); // the reload comes when the worker has taken over (controllerchange)
  }

  if (!waitingWorker || later) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 bottom-3 z-30 mx-auto max-w-md rounded-2xl border border-line bg-surface p-4 shadow-lg"
    >
      <p className="text-base font-semibold text-ink">A new version is available — Refresh</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button type="button" onClick={refresh} className={buttonClasses("primary")}>
          Refresh
        </button>
        <button type="button" onClick={() => setLater(true)} className={buttonClasses("secondary")}>
          Later
        </button>
      </div>
    </div>
  );
}

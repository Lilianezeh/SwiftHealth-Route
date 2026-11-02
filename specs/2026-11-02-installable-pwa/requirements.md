# Requirements: SwiftHealth Route as an installable app (PWA)

Branch `feature/installable-pwa`. Status: **built (2026-11-02); draft pull request.** The owner's request of 2026-11-02.

## What this covers

| ID | Requirement (from specs/prd.md) | Priority |
| --- | --- | --- |
| NFR-03 | Offline: the emergency page and its numbers work offline after one visit (installable web app) | Must |
| FR-17 | The SwiftRescue page is kept for offline use after the first visit | Must |
| NFR-04 | Privacy: nothing personal is kept on the device; the visitor's location is never stored | Must |
| NFR-10 | Accessible, 16 px text, 48 px targets, Light and Dark, tidy at 320 px | Must |

## What existed before (inventory, read-only)

- `src/app/manifest.ts`: name, short name, `start_url`, standalone, two icons (192, 512), no maskable icons, no shortcuts.
- `public/icons/icon-192.png`, `icon-512.png`, `src/app/icon.svg` (tab icon). No Apple touch icon.
- `public/sw.js` version 1: kept only `/emergency`, `/blood` and their files; took over at install (`skipWaiting`).
- `RegisterServiceWorker` was placed by hand on the SwiftRescue page and the Find blood page only.

## Decisions (the owner's list, built as asked)

1. **Manifest:** name "SwiftHealth Route", short name "SwiftHealth", `start_url` "/", standalone, scope "/", Light colours, icons 192 and 512 plus maskable
   versions, an Apple touch icon, shortcuts SwiftRescue (`/emergency`) and Find care (`/find`).
2. **Service worker on every public page**, today's offline behaviour for `/emergency` and `/blood` kept, and a simple offline page for any other page
   ("You're offline. SwiftRescue still works: call 112.").
3. **Never kept:** admin, provider, account, log-in, sign-up, password pages, payment returns, any address with a query, any API response, and the
   visitor's location.
4. **Updates:** the new worker waits; the page shows "A new version is available — Refresh" (Refresh, Later). The old cache `swiftrescue-v1` is deleted
   when the new worker activates, so old files are not kept for ever.
5. **Install button:** "Install app" in the phone Menu and once on the home page (dismissible, "Not now" remembered in local storage inside a try/catch);
   on iPhone Safari the sentence "Tap Share, then Add to Home Screen"; hidden when already installed.
6. Accessible, 16 px, 50 px buttons, Light and Dark, one column at 320 px.

## Choices to know about

- `short_name` changed from "SwiftHealth Route" to "SwiftHealth" (as asked); it is the label under the icon.
- The Menu exists only on a phone, so on a wide screen the home card and the browser's own install icon are the ways to install.
- The existing visitors of version 1 get the "new version" notice once (version 1 took over by itself; version 2 waits).
- The service worker registers only in a production build, so it can be tested on the deployed preview or a local production build, not on the dev server.
- No new table, endpoint, package or setting.

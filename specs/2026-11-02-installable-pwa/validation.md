# Validation: SwiftHealth Route as an installable app (PWA)

Check these before saying the feature is done. The merge checklist is complete only when the owner has done the phone checks.

## Automatic (done on the final commit)

- [ ] `npm run lint`, `npm run typecheck` and `npx vitest run --maxWorkers=2` pass (backend untouched).
- [ ] Manifest test: names, colours, scope, icons (four, one purpose each), shortcuts in order.
- [ ] Service worker test: never keeps admin, provider, account, log-in, sign-up, payment or any address with a query, any API (other site) response,
  redirects, opaque or `no-store`/`private` responses; keeps `/emergency`, `/blood`, their files and `/offline.html`; offline fallback for other pages;
  no `skipWaiting` at install; deletes old `swiftrescue-*` caches.
- [ ] Install tests: Menu row, iPhone sentence, hidden when installed, home card, "Not now" saved in a try/catch.
- [ ] Browser spec `tests/end-to-end/pwa.spec.ts` (11 checks, Light and Dark, 320 and 375 px, iPhone Safari): manifest and icons served, offline page, the Menu
  row before the Theme row beside the header without Log in or Sign up and the footer with Staff portal, the home card and "Not now" after a reload.
  The service worker itself registers only in a production build, so it is checked by hand below.

## On the computer (Chrome DevTools, production build or the deployed preview; the worker does not register on `next dev`)

- [ ] Application, Manifest: name, short name, start URL "/", display standalone, theme and background colours, four icons, no warnings; "Installability" shows no errors.
- [ ] Application, Service workers: `/sw.js` activated and running; Cache storage holds `swiftrescue-v2` after one visit to SwiftRescue.
- [ ] Network "Offline" box on: `/emergency` and `/blood` still open; another page (for example `/about`) shows the offline page.
- [ ] Cache storage never contains `/admin`, `/provider`, `/account`, `/log-in` or an API address.

## On the phone

- [ ] Android Chrome: open the preview, wait a moment, tap the Menu: "Install app" is there (also once on the home page). It installs and opens without the browser bar. Long-press the icon: SwiftRescue and Find care shortcuts.
- [ ] iPhone Safari: the Menu and the home card say "Tap Share, then Add to Home Screen"; after adding, the app opens full screen and neither shows.
- [ ] Airplane mode: SwiftRescue opens after one earlier visit; other pages show "You're offline. SwiftRescue still works: call 112."
- [ ] After a new deploy, reopen the app: "A new version is available — Refresh" appears; Refresh reloads once.
- [ ] Dark theme and a 320 px width look tidy; every button is easy to tap.

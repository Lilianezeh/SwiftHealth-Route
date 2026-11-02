# Plan: SwiftHealth Route as an installable app (PWA)

Tests were written first, then the code. Tick each task with its commit hash at the end of the feature.

- [ ] 1. Tests: service worker rules (`tests/unit/serviceWorker.test.ts`), offline page (`offlinePage.test.ts`), manifest (`manifest.test.ts`), icons
  (`appIcons.test.ts`), registration and update notice (`RegisterServiceWorker.test.tsx`), install states (`installPrompt.test.tsx`).
- [ ] 2. `public/sw.js` version 2 and `public/offline.html`.
- [ ] 3. `src/app/manifest.ts`, `appleWebApp` in `src/app/layout.tsx`, icons by `frontend/scripts/make-app-icons.mjs` (maskable 192 and 512, `apple-icon.png`).
- [ ] 4. `src/lib/pwa/` (install store, dismissal, reload) and `src/components/pwa/` (listener, Menu row, home card, `PublicPwa`).
- [ ] 5. `RegisterServiceWorker` rewritten; placed by the two layouts (home, public) instead of the SwiftRescue and Find blood pages.
- [ ] 6. `MobileMenu` (install row), home page (install card), `netlify.toml` headers for `/offline.html` and `/manifest.webmanifest`.
- [ ] 7. UI spec 2.11, LOG.md, this folder; full frontend suite, lint, typecheck; draft pull request.

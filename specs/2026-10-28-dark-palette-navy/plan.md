# Dark palette: Midnight Navy: plan

Requirements: [requirements.md](requirements.md). Tests first.

1. Tests (red first)
   - `tests/unit/darkMode.test.ts`: the role and constant token lists, the navy values (blue first, not grey, not pure black, cards lighter), every light token pinned to its old value, new pairs (white on `pine`, `bar`, `hero-from`, `hero-to`, `veil`; the paper ring; the white edge of SwiftRescue).
   - `tests/unit/darkModeSource.test.ts`: bars use `bg-bar`; the hero uses the hero tokens and a dark-only tint; SwiftRescue has a 2 px white edge.
   - `tests/unit/HomeSections.test.tsx`, `SiteHeader.test.tsx`: the old class names replaced by the new ones; the veil is solid to 4.5 rem and measured for the light and the dark veil colour.
   - `tests/end-to-end/hero-header-contrast.spec.ts` (new): the real pixels behind each header item and behind the rows of the header across the whole width, and behind the slideshow text on each of the five photos, in both modes, at 360, 768 and 1280 px. It failed first (SwiftRescue's edge 1.01:1, the Menu edge 2.75:1, the rows 3.8:1 to 4.3:1).
2. Code: `src/styles/globals.css` (tokens), `HomeHero.tsx`, `SiteHeader.tsx`, `MobileMenu.tsx`, `WhySwiftHealth.tsx`, `app/(public)/find/page.tsx`, `HeaderNavigation.tsx`.
3. Checks: unit suite, `tsc`, lint, the browser specs for dark mode and the hero, the full browser suite, Lighthouse (Accessibility and Performance) on a production build in Light and Dark.
4. Docs: `specs/frontend/ui-spec.md` "Dark mode"; this folder; `LOG.md` once, at the end.

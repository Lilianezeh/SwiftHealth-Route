# Hero photo slideshow: plan

Requirements: [requirements.md](requirements.md). Tests first.

1. Config: `src/config/sitePhotos.ts`: `HERO_SLIDES` (five photos: files, size, alt, `focus` and `focusWide`); remove `BACKDROP_PHOTOS` and `BACKDROP_STRENGTH`; keep `MAGNIFIC_CREDIT` for the footer.
2. `src/components/home/HeroSlideshow.tsx` (client): the band's frame, the first slide as `children` from the server (the stethoscope's `<picture>`, unchanged), the other slides added after the page has loaded, one step ahead; 6 s timer, crossfade, previous / next / dots / Pause, hidden tab, reduce motion. `HomeHero.tsx` stays a server component.
3. `FindByType.tsx`: plain section; delete `BackdropSlideshow.tsx`, its tests, the `.section-lazy` CSS and the `BACKDROP_*` config.
4. Credits: remove from `GroupPhoto.tsx`; add the line to `SiteFooter.tsx`.
5. Address bar: `lib/theme/theme.ts` and the head script set `<meta name="theme-color">` with the theme (light `#1b6f93`, dark `#0a1628`); `layout.tsx` keeps the light value for the first paint.
6. Tests (red first): `heroSlides.test.ts` (config, files, focus crop maths at 6 widths), `HeroSlideshow.test.tsx` (behaviour), `SiteFooter.test.tsx` and `GroupPhoto.test.tsx` (the credit), `theme.test.ts` (the meta tag), `HomePage.test.tsx`, `homePerformance.test.tsx`; browser: `hero-slideshow.spec.ts` (replaces the slideshow part of `home-photos.spec.ts`): the band's box is the same, the photos are as bright in Dark as in Light, CLS 0, controls, keyboard, Pause, hidden tab, reduce motion, the footer at 320 px.
7. Checks: unit, `tsc`, lint, full browser suite, Lighthouse in both modes on a production build, screenshots at 360 and 1280 px in Light and Dark (kept in `specs/2026-10-28-hero-slideshow/screenshots/` and linked from the PR).
8. Docs: `ui-spec.md` 2.1, this folder, `LOG.md` (the credit moved to the footer, once, at the end).

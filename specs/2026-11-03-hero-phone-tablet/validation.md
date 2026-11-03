# Validation: Home hero on phones and tablets, and For facilities shown once

## Automatic

- [ ] `npm run lint`, `npm run typecheck` and `npx vitest run --maxWorkers=2` pass (backend untouched).
- [ ] Browser: `hero-slideshow.spec.ts`, `home-layout.spec.ts`, `hero-header-contrast.spec.ts`, `dark-mode.spec.ts` and `signup.spec.ts` pass.
- [ ] Faces: the whole face of every photo is at least 8 px inside the photo box from 320 to 1023 px.
- [ ] Laptop: at 1280 x 800 the header is transparent over the photo, the veil shows, the left edge slants and the controls are over the photo.

## By eye (Light and Dark)

- [ ] 360 x 740: header bar, photo, controls, heading, line and "Find care near me" all on the first screen; no sideways scroll at 320 px.
- [ ] 390 x 844 and 768 x 1024: the photo is clear, no part is cut, nothing is over it, the controls row is centred and tidy.
- [ ] Press the dots, Previous, Next and Pause: each is easy to tap (48 px); the photo still changes by itself every 6 seconds.

## Speed (on the Netlify preview, mobile)

- [ ] PageSpeed mobile 90+, Accessibility 100, CLS 0 (the photo box has its height from CSS, so nothing moves when a photo loads).

## For facilities

- [ ] `/for-facilities` shows "Sign up as a facility owner" and "Log in" once, near the top; the end of the page has only "List your facility".

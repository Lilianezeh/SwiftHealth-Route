# Dark palette: Midnight Navy: requirements

Requirement: NFR-10 (readable, consistent screens, WCAG AA). Owner's request of 2026-10-27 and choice of Option A on 2026-10-28. Parents: `specs/2026-10-27-dark-mode/`, `specs/2026-10-27-light-default-theme/` (Light stays the default; Dark only through the Theme button).

## Why
The first dark mode (#69) kept the hero, the header and the bands blue as in the light mode, so on a dark page they clashed, and the page itself was a green-grey near-black. The owner chose Option A, "Midnight Navy", from two palettes shown as screenshots.

## Rules
1. **Light mode does not change.** Every light colour keeps its value (a test pins all of them). The new tokens (`bar`, `hero-from`, `hero-to`, `veil`) say, in the light mode, exactly the colour the class used before.
2. **Deep navy, not black or grey.** Page `#0a1628`, cards `#11233f` (a little lighter), blue accents, white and light text. Values are in ui-spec "Dark mode".
3. **The hero, the header and every home section have a dark version:** the gradient from a deep navy to a royal blue, the photo dimmer with a navy tint (dark mode only), the header and the Menu a navy bar, the "Why" band a navy band, the overview, the type tiles and the owners section on the page and card colours.
4. **The 112 card stays clearly red** (a red border, the red Call 112 button with white text). The photos and the Magnific credit stay readable (the credit and Pause sit on a card colour).
5. **WCAG AA everywhere:** 4.5:1 for text, 3:1 for icons, button edges and the focus ring, pair by pair in `tests/unit/darkMode.test.ts`; Lighthouse Accessibility 100 in both modes.
6. **The header over the hero photo (owner, 2026-10-28):** its items (the logo, For facilities, Log in, the Theme button, SwiftRescue, the phone Menu button) stay clearly visible on every part of the photo, in both modes: 4.5:1 for the words, 3:1 for the icons and for each button's edge, measured on the real pixels. The slideshow photos are checked the same way for the text laid over them (the "Find by type" heading, Pause, the Magnific credit), photo by photo.
7. Light stays the default; Dark comes only from the Theme button (or System, chosen with it).

## Changes the owner did not list, and why
- The **SwiftRescue** button gets a 2 px white edge, in both modes. Measured on the real pixels, its red against the veil (or the bar) was 1.01:1, so its edge could not be seen; it is identified by its words, but the owner asked for 3:1 on the button edge. Its width does not change.
- The phone **Menu** button's edge is solid cream instead of 60% (2.75:1 before, over the veil and over the bar).
- The **veil** under the header over the hero photo is a little taller and darker (85%, solid for 4.5 rem; it was 80% and 3 rem) in both modes, because the lower part of the header items measured 3.8:1 to 4.3:1 over a white sheet of the photo, also in the light mode.

## Not in this change
- The 11 px by which the home header is too wide at 360 px on this machine's fallback font (known, in LOG.md): the same with and without the navy palette.
- The browser's address-bar colour stays the light header blue in both modes.

## Owner steps
None. No migration, no variable on Render or Netlify.

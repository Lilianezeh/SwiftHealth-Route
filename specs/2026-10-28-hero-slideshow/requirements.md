# Hero photo slideshow: requirements

Requirements: US-13, NFR-01 (light for 3G), NFR-10 (readable, WCAG AA, tap targets), NFR-13 (photo credits). Owner's request of 2026-10-28. Replaces the "Find by type" background slideshow of `specs/2026-10-22-home-photos/` (revision 4).

## What the owner asked for
1. **The hero photo band changes photos.** The stethoscope stays and is always the first slide; then clinic, hospital, maternity, laboratory, pharmacy (the five photos the "Find by type" slideshow used: `nurse-corridor`, `doctor-and-patient`, `consultation`, `laboratory`, `pharmacist-customer`).
2. **Same area and shape as the stethoscope photo today.** Same size, same diagonal edge, no layout change, CLS 0. **Full brightness in both Light and Dark**: no wash, tint or filter on any photo; the only shade over the photos is the existing one under the header. Each photo has a focus point, so no face is cut at 320, 360, 768 and 1280 px. The heading and text look exactly as now.
3. **It changes by itself every 6 seconds** with a soft crossfade, **and by hand**: ‹ previous and next › buttons and dots (48 px targets, `aria-label`s, keyboard). A visible **Pause / Play** button (WCAG 2.2.2). It stops while the tab is hidden. With reduce motion: no automatic change, the buttons still work.
4. **Credits.** No "Designed by Magnific" credit on any photo (the hero, the ambulance and fire photos of /emergency, anywhere). Instead **one** line in the site-wide footer, at the bottom right: "Photos: Designed by Magnific", linking to www.magnific.com, 16 px, readable in Light and Dark (WCAG AA), tidy at 320 px. LOG.md records that the credit moved to the footer.
5. **Speed.** The stethoscope stays the priority image exactly as today (`fetchPriority="high"`, eager, the phone file for phones). The other photos load only after the page has loaded (and a little ahead of their turn). Live PageSpeed (mobile) must stay 90 or more and Accessibility 100 in both modes.
6. **Remove the faint slideshow from behind "Find by type" completely**: the component, its Pause button, credit, script (the client code), CSS and tests; back to a plain section (the five tiles as they are now, on the light-blue band, with a plain heading). `hero4` (the owners' portrait) and everything else stay.
7. **The browser address-bar colour (`theme-color`) is navy in the Dark mode** (and stays the header blue in the Light mode). It follows the Theme button, not the device.

## Rules I applied (owner's earlier rules)
- Light is the default for everyone; Dark only through the Theme button.
- No light-mode colour changes except what this feature needs: the new controls and the footer credit use the existing tokens.
- Text 16 px or more, targets 48 px or more, WCAG AA, Lighthouse Accessibility 100.
- The photos are not decorative any more (they are the hero): each has a short, factual alt text (no medical claim). The slides that are not shown are hidden from screen readers (`aria-hidden`), and the controls are named.

## Decisions I took (tell me to change any)
- **D1. Controls over the photo.** Previous, next, Pause/Play and the dots are round buttons with a dark fill (the `control` token: `#0e3a4f` in Light, `#0a1628` in Dark) and a white edge (a fill that stands out from a bright photo, an edge that stands out from a dark one: at least 3:1 against every grey level, checked by maths, and measured on all six photos). They sit at the bottom of the band. Up to 479 px they take two rows (dots, then buttons), below the faces; from 480 px one row, at the left. The band's size does not change.
- **D2. Photos are the existing files.** The five photos stay in `public/images/backdrop/` (800 and 1600 px); no new files. The 800 px file goes to phones (up to 767 px), the 1600 px file to wider screens.
- **D3. Focus points differ by width.** A narrow band crops the sides, a wide band crops the sides of a tall frame, a tablet band crops top and bottom; each photo has a focus point for the phone and tablet band (`focus`) and one for the desktop band (`focusWide`), checked by a test that computes the crop at 320, 360, 768, 1024, 1280 and 1440 px.
- **D4. The address bar.** Light `#1b6f93` (as now), Dark `#0a1628`, the navy of the Dark header and hero in the navy dark mode (#73, still open). Until #73 is merged the dark header is still the blue, so the navy bar would not match it.
- **D5. Live PageSpeed.** I cannot run PageSpeed on the live site before it is deployed. I measure Lighthouse (mobile preset) on a production build here and report it; the live number is yours to check after the deploy.

## Not in this change
- The 360 px home header that is 11 px too wide on this machine's fallback font (known).
- The dark mode's colours (#73).

## Owner steps
None. No migration, no variable on Render or Netlify.

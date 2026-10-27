# The "For facilities" page: validation

Requirements: [requirements.md](requirements.md). Plan: [plan.md](plan.md). UI spec 2.9b.

## Results (2026-10-27)
- Backend: **2135 passed**, ruff clean. New cases in `test_meta.py`: the exact keys now include `featured_price_naira`; it is a string with two decimals ("5000.00"); it follows the setting (7500.5 becomes "7500.50") and is a string in the JSON text; it is the same price Paystack gets (12345.67 is 1234567 kobo).
- Frontend: 127 files, 2008 tests (one failure in the full run was `meta.test.ts` listing the exact keys of `/meta`; fixed, passes); lint and `tsc` clean. New: `ForFacilitiesPage.test.tsx` (18): one `h1` and the four `h2` in order; the free-listing sentence; the verification text; the Featured rules; the four steps in an `ol`; the price from the API in naira, with kobo when there are any, and left out when the API fails; no amount written in the source; Sign up only while sign-up is open (and not when the API fails), List your facility always; both buttons at least 50 px; no city, no medical or legal words, no phone number or address; a server page with only the small client part; the header and Menu link. The header, Menu, sitemap, metadata and route-list tests were updated for the new link and page.
- Real browser, **4 of 4 widths (320, 360, 768, 1024 px)** for `/for-facilities` in `info-pages.spec.ts` (one heading, the title, nothing sideways, readable text and big links), and the sitemap check.
- Not run: Lighthouse on this page (planned once, for every new page, at the end of the dark-mode work); a phone.
- **Render / Netlify:** nothing to change. No migration, no variable. The price shown is the one in `FEATURED_PRICE_NAIRA` on Render (default 5000.00).

# The "For facilities" page: plan

Requirements: [requirements.md](requirements.md). Tests first.

1. Spec: `ui-spec.md` 2.9b and the header line; `api-spec.md` `/meta` (`featured_price_naira`).
2. Backend: `MetaResponse.featured_price_naira` (string, 2 decimals), filled from `settings.featured_price`; tests in `test_meta.py`.
3. Frontend: `app/(public)/for-facilities/page.tsx` (server), `components/facility/ForFacilitiesParts.tsx` (the price and the buttons), `siteConfig` header and Menu links, `sitemap.ts`; tests in `ForFacilitiesPage.test.tsx`, and the header, Menu, sitemap and metadata tests updated.
4. Real browser: the page in `info-pages.spec.ts` at 320, 360, 768 and 1024 px; the sitemap check.

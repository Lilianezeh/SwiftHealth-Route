# Sponsored rules check: plan

Requirements: [requirements.md](requirements.md). One requirement per change; tests first.

1. Spec: `api-spec.md` section 8, "Sponsored rules" (done first).
2. Tests first: `backend/tests/integration/test_sponsored_rules.py` (17 cases for the four rules); frontend `featured.test.ts` and two cases each in the provider screen tests.
3. Code: `is_verified_and_current` in `services/verification.py`; `payment_service.start_featured_payment` raises `ListingNotVerifiedError` (route: 400 "Only a verified listing can be featured."); `search_service.first_sponsorable` skips a listing that is not verified or is overdue; frontend `lib/staff/featured.ts` (`whyNotFeatured`) used by "My facility" and "Get featured".
4. Fixtures: the sponsored and payment tests now create verified listings (they relied on the old, looser rule).

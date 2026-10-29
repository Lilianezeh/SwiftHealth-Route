# Validation: owner fee (proposal only)

This feature is a proposal. There is nothing to validate yet; this list is for when the owner says yes and the work is built.

- [ ] Q1 to Q10 answered; the lawyer's wording for L1 to L8 received.
- [ ] Still exactly 10 tables; `paid_until` migration reversible (upgrade, downgrade, upgrade).
- [ ] Test mode only: a `sk_live_` key is refused; no real money moved; the Paystack dashboard webhook URL set by the owner (the step is in the LOG row).
- [ ] Only a signed webhook confirms a payment; a repeated webhook applies once; every payment and refund is an audit entry with its reference.
- [ ] The claim reaches staff only after the first confirmed payment; a rejected claim is refunded in full.
- [ ] A lapsed owner cannot edit; the listing stays public, free and unchanged; paying restores editing without a new staff approval.
- [ ] Staff sign-up and staff accounts are never charged; visitors never see a fee.
- [ ] Featured: still at most one, labelled "Sponsored", never in SwiftRescue or the blood pages; the owner fee changes no ranking.
- [ ] Texts on Terms, Privacy, "For facilities", home and "List your facility" match the lawyer's wording; "free during our launch" replaced as agreed.
- [ ] Full backend and frontend suites, Lighthouse accessibility 100 in both modes on the changed pages, Playwright at 360 and 1280 px.

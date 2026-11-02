# Validation: Log in and Sign up out of the public header

Spec: [requirements.md](requirements.md). Boxes are ticked with the evidence at the end of the feature, after the owner has looked at the
preview. Check this file before saying the feature is done.

## Build results

(filled in with the real numbers from the final runs, see the pull request)

## Checks

- [ ] Logged out, the header has no Log in and no Sign up, in the bar or in the phone Menu, whether sign-up is open or not; on the home page it is only SwiftRescue, For facilities and the Theme button.
- [ ] Logged in, My account is in the bar (from tablet width) and in the Menu, to where the role starts.
- [ ] The header makes no request to the API.
- [ ] `/for-facilities` has "Sign up as a facility owner" and "Log in" near the top and at the end; sign-up shows only while it is open, else "Sign-up is not open yet.".
- [ ] "Sign up as a facility owner" opens `/sign-up` on the Facility owner form (the question is not asked).
- [ ] The footer has a small "Staff portal" link, last, on every page including the home page.
- [ ] `/staff-portal` has "Log in" and "Sign up as staff" (only while open) with the sentence that an admin must approve; "Sign up as staff" opens the Staff form with the admin note.
- [ ] `/staff-portal` is not indexed, not in the sitemap, not in the header or the Menu.
- [ ] `/log-in` is unchanged; `/sign-up` with no choice still asks the question.
- [ ] The home page still says "Free to use · No sign-up needed".
- [ ] Text 16 px or more, targets 48 px or more, nothing wider than the screen at 320 px (real browser), and readable in Light and Dark (the owner looks at the preview).
- [ ] Frontend `lint`, `typecheck` and `npm test` pass.

## Open for the owner

- "Find care" stays in the bar on the pages other than the home page (see requirements).
- The login page's own "No account yet? Sign up." line is unchanged.

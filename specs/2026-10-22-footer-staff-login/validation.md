# Footer link "Staff and provider login": validation

Requirements: [requirements.md](requirements.md).

## Results (2026-10-22, branch `feature/footer-staff-login`)

- Frontend: `vitest` **1446 passed** (104 files); `tsc --noEmit` and `next lint` clean. 4 footer tests were red first (they failed before the link existed).
- Real browser at 320, 360, 768 and 1024 px: `footer-login.spec.ts` **16 passed**: the footer fits the screen (nothing wider, every link 47.5 px or more high, no text under 16 px), the
  login link has its own line between the information links and the © line, the link opens `/admin/login`, a provider lands on `/provider`, an editor on `/admin` (the dashboard)
  and a verifier on `/admin/listings?mine=true` (the login calls are faked: no password exists here, nothing is written).
- Backend: not touched.

## Checklist
- [x] Footer link `Staff and provider login` to `/admin/login`, 48 px, 16 px text, own line, not prefetched
- [x] The six information links are unchanged; the © line is still last
- [x] The login is linked from nowhere else (a test reads the header, menu and site settings)
- [ ] The pull request stays a draft until the owner has looked at the footer on a phone.

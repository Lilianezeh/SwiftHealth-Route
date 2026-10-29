# Plan: automatic sign-out after no activity

Branch `feature/idle-sign-out`, one draft pull request. Requirements: [requirements.md](requirements.md).

- [x] Specs first: `api-spec.md` (`POST /auth/keep-alive`, `expires_in`), `ui-spec.md` 3.1a.
- [x] Backend tests first: `tests/unit/test_security.py` (limit per role, claims, renewal keeps the session start), `tests/unit/test_config.py` (defaults, minimum 2), `tests/integration/test_idle_session.py` (login `expires_in`, settings, idle token refused, keep-alive, longest session, deactivated, password change).
- [x] Backend: `core/config.py` (two settings), `core/security.py` (`idle_limit_for`, role-aware `create_access_token`, `sts`, `expires_at`), `services/auth_service.py` (longest-session check, `refresh_access_token`), `api/routes/auth.py` (`POST /auth/keep-alive`), `schemas/auth.py` (`TokenRefreshed`), `account_service.py` / `routes/account.py` (password change token).
- [x] Frontend tests first: `IdleSignOut.test.tsx` (25), `SignedOutNotice.test.tsx`, additions to `LoginForm.test.tsx`, `StaffGate.test.tsx`, `ListYourFacility.test.tsx`.
- [x] Frontend: `config/idle.ts`, `lib/staff/idle.ts`, `lib/api/staff.ts` (`keepAlive`), `hooks/useIdleSignOut.ts`, `components/layout/IdleSignOut.tsx` (in the root layout), `components/admin/SignedOutNotice.tsx` (login page), `LoginForm.tsx` (keeps `expires_in`), `StaffGate.tsx` and `ListYourFacility.tsx` (always send the newest token).
- [x] Docs once at the end: `LOG.md` (decisions I1 to I7), `validation.md`.
- [ ] After the merge, by the owner: set `IDLE_MINUTES_ADMIN` / `IDLE_MINUTES_OTHER` on Render only if the defaults (5 and 15) are not wanted; try it with a real browser (validation.md). Tick with the commit hash at the end of the feature.

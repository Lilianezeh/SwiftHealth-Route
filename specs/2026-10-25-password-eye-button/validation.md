# Show / hide password button: validation

Requirements: [requirements.md](requirements.md). Plan: [plan.md](plan.md). Branch `feature/password-eye-button`, 2026-10-25.

## Results
- **Frontend:** `vitest` **110 files, 1648 tests passed** (full run); `tsc --noEmit` and `next lint` clean. No backend change.
- **Tests written first:** `tests/unit/PasswordField.test.tsx` (18) and one test in each of `LoginForm`, `TwoFactorSetup` and `StaffAccounts`; every older test of those screens passes unchanged (the password inputs still have `min-h-12` and the same ids, labels and `autocomplete`).
- **Real browser on a production build** at 320, 360, 768 and 1024 px: the eye is inside the field at its right edge, **48 px wide and 48 px high or more**, the typed text has 56 px of room at the right (`pr-14`), nothing runs past the screen, pressing it shows then hides the password without sending the form, the password is hidden again after "Send me a code" and after "Start again". `staff.spec.ts` login, password-eye and security tests **24 of 24** passed. A screenshot at 320 px was looked at: the eye sits inside the field, the shown password and the button do not overlap, blue (`forest`) icon.
- **One change to older tests:** Playwright's `getByLabel` matches an element's `aria-label` too, so `getByLabel("Password")` matched the new eye button ("Show password") as well and failed in strict mode. The real-browser tests now say `{ exact: true }`. The unit tests were not affected (Testing Library's text match is exact).

## Checklist
- [x] One shared component; every password field uses it (a test fails otherwise)
- [x] Real button, `aria-label` "Show password" / "Hide password", `aria-pressed`, at least 48 px, keyboard, never submits
- [x] Hidden again after submit and when the page is left
- [x] Paste and the password manager keep working: the same input, `autocomplete` unchanged
- [x] 16 px, blue tokens only, fits at 320 px, nothing written by hand so a dark mode is one place
- [ ] The owner looks at the login and the Security screen on a phone

## Not done
Dark mode itself (the tokens are used, so it is one place when it comes); the sign-up, change-password and reset-password screens do not exist yet, and will use this component.

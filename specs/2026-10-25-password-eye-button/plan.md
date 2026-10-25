# Show / hide password button: plan

**Status: built 2026-10-25, draft PR.** Requirements: [requirements.md](requirements.md). Rules (CLAUDE.md): tests first, one requirement per change, `git branch --show-current` before every commit and push, draft PR.

| File | Change |
| --- | --- |
| `frontend/src/components/ui/PasswordField.tsx` | New: the one password field with the eye button |
| `frontend/src/components/admin/LoginForm.tsx`, `TwoFactorSetup.tsx`, `StaffAccounts.tsx` | Use it instead of their own `<input type="password">` (five fields) |
| `frontend/tests/unit/PasswordField.test.tsx` | New: 18 tests (below) |
| `frontend/tests/unit/LoginForm.test.tsx`, `TwoFactorSetup.test.tsx`, `StaffAccounts.test.tsx` | One test each: the screen has the eye and hides the password again |
| `frontend/tests/end-to-end/staff.spec.ts` | A test at 320, 360, 768 and 1024 px; `getByLabel("Password", { exact: true })` |
| `specs/frontend/ui-spec.md` | "Password fields" in "Buttons and text" |

## Tasks
- [x] Tests first: `PasswordField.test.tsx` (hidden at first; the label, `aria-pressed` and `type` follow the button; the same input element stays; a paste works hidden and shown; `autocomplete` passes through in both states; the button never submits (click, Enter, Space); Tab reaches it; 48 px classes; the icon is hidden from screen readers; back to hidden after submit and after `pagehide`; starts hidden when drawn again; the listeners are removed; design tokens only; no paste blocking; **no other file writes a password input**).
- [x] The component, then the five fields.
- [x] The three screens' tests, then the real-browser test.
- [x] Full suites, the draft PR.

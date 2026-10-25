# Show / hide password button: requirements

Owner's request of 2026-10-25, to be done after the start-up key message (PR #52). Branch `feature/password-eye-button`, from `main`. UI rules: [ui-spec.md](../frontend/ui-spec.md), "Buttons and text", "Password fields". Requirement IDs: NFR-10 (large tap targets, 16 px text), NFR-06 (security), US-13 (small screens).

## What the owner asked for

An eye button **inside the right edge of every password field**, in **one shared component** so every present and future password field (staff login, the Security screen's password step, admin create and edit user, and the sign-up, change-password and reset-password screens to come) behaves the same.

- Tapping it shows the password; tapping again hides it.
- **Accessible:** a real button with `aria-label` "Show password" / "Hide password" and `aria-pressed`, at least 48 px to tap, works with the keyboard, and **never submits the form**.
- The password goes **back to hidden** after the form is submitted or the page changes.
- **Paste and the browser's password manager keep working** (correct `autocomplete` values).
- 16 px minimum, the blue palette, fits at 320 px, and works in dark mode later.

## How it is done

- **One component:** `frontend/src/components/ui/PasswordField.tsx` (`id`, `value`, `onChange`, `autoComplete` of `current-password` or `new-password`, `required`, `name`). The caller keeps its own `<label htmlFor>`.
- **Same input, different type:** the eye only changes `type` between `password` and `text` on the **same** input element (never a second input), so a paste, the caret and the password manager are not disturbed. `autocomplete` never changes. The keyboard's capital letter, autocorrect and spell check are off.
- **Hidden again:** a native `submit` listener on the form (it runs even when the screen's own handler stops the submit) and a `pagehide` listener (which also fires when the browser keeps the page for the back button). A new draw of the field (another page or step) starts hidden because the state is the component's own.
- **Size and colours:** the button is `w-12` and as high as the field (`min-h-12`, at least 48 px), the field has `pr-14`, the icon is 20 px and decoration only (`aria-hidden`). Colours are the design tokens only (`forest`, `pine-dark`, `line`, `ink`), nothing written by hand and nothing red, so a dark mode changes them in one place.
- **Used by:** `LoginForm` (the staff login), `TwoFactorSetup` (the password step, and the password of "new backup codes" and "switch it off"), `StaffAccounts` (the new user's password and the new password of a user).
- **A guard:** a test reads every file under `src/` and fails if any file other than `PasswordField.tsx` writes a password input, so a future screen cannot forget the eye.

## Not changed

The API, the password rule (8 for a provider, 10 for staff and admin, common passwords blocked), the labels of the fields, and the tests' use of the labels (the real-browser tests now use `getByLabel("Password", { exact: true })`, because Playwright's `getByLabel` also matches the eye button's `aria-label` "Show password").

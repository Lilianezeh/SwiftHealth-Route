# Validation: free email by SMTP

## Done by me (2026-11-01)
- [x] Tests first, with a fake SMTP server on this machine (a real STARTTLS handshake, a throw-away certificate): the message arrives over TLS; the password is sent only after TLS began; a server without STARTTLS gets no password and no message; a server whose certificate is not trusted gets nothing; a refused login, a refused recipient, an unreachable server and a subject with a line break are errors that hold no password, user name, sender or address (checked in the error and in the log); a body with `₦` arrives intact; the sender falls back to the user name when it is an address.
- [x] Resend is used when it is set up, SMTP when it is not, nothing otherwise; half of a setting is none of it; an account code goes by SMTP outside development; the login-code channel and forgot-password use either way.
- [x] `/meta` says `signup_open` is true outside development with `SIGNUP_ENABLED=true` and SMTP alone (no Resend, no Termii) and false when the setting is off or SMTP is incomplete.
- [x] Backend: ruff clean; full suite result in the pull request.
- [ ] **Not tested against Gmail or any real server** (only the fake one). The first real send is the test.

## The Render route: read this before adding variables
**Render's free web service blocks outbound SMTP on ports 25, 465 and 587** (Render changelog, live since 26 Sep 2025; a paid instance type lifts it). So with the API on the free plan:
- **Gmail (587 or 465) cannot work.** It would need the API on a paid instance.
- **A mail service that accepts STARTTLS on port 2525** can work: set `SMTP_PORT=2525`. Check on the provider's page that the free plan allows it and whether a sender address is enough without your own domain.
Decide this first. Adding the variables below changes nothing until you do, and sign-up stays closed while `SIGNUP_ENABLED` is not `true`.

## Render variables, in this order (API service, Environment)
1. `SMTP_HOST`: the server's name, for example `smtp.gmail.com` (plain text, no `https://`).
2. `SMTP_PORT`: a whole number: `587` (STARTTLS; the default if you leave it out), or `2525` for a service that offers it.
3. `SMTP_USERNAME`: the login. For Gmail: the whole address of a **dedicated** Google account, for example `swifthealth.route@gmail.com`.
4. `SMTP_PASSWORD`: a **secret**. For Gmail: an **app password** (Google account → Security → turn on 2-Step Verification → App passwords → make one; 16 letters, shown once; type it without spaces). Never the account's real password. Paste it only into Render.
5. `EMAIL_FROM`: the sender as readers see it, for example `SwiftHealth Route <swifthealth.route@gmail.com>`. Gmail sends from the logged-in account whatever you write here. Empty is allowed when `SMTP_USERNAME` is an address.
6. Save: Render restarts the API. **Do not set `SIGNUP_ENABLED` yet.** Leave `RESEND_API_KEY` and `RESEND_FROM_EMAIL` empty (if Resend is set up, it is used first).
7. Open `<API address>/meta`: `"signup_open"` must still be `false`.
8. **Test the mail path before opening sign-up:** on the site choose "Forgot your password?" for an **existing account whose email you can read** (your own admin or a test account). A code mail must arrive (look in spam too). The page answers the same for an unknown email, so only a received mail proves it. If nothing arrives, the Render log shows `Could not send through SMTP (<ErrorClass>)` (for example `TimeoutError` or `OSError` means the port is blocked or wrong; `SMTPAuthenticationError` means the user name or the app password): the log never shows the password, the user name or an address.
9. Only when 8 works: set `SIGNUP_ENABLED` to exactly `true`. After the restart `/meta` shows `"signup_open": true` and the header shows "Sign up". Switch it back to `false` to close sign-up again at any time.

## How to test a real sign-up safely
1. Use a **second mailbox you own** (not a stranger's) and a fictional name such as "Test Owner"; choose **Facility owner** (no staff approval needed). A phone number you control, or a clearly fictional +234 number: the code is not texted, because Termii is off.
2. Submit the form; read the **email code** (spam too) and confirm it.
3. The phone step: with no Termii, the account waits until an admin confirms the phone **by call** (decision D20): log in as admin → `/admin/staff` → the account → "Confirm phone by call". Then the test account can log in (the login code goes by email, because there is no Termii).
4. Try one wrong code and one "Send a new code" to see the limits (60 seconds apart, 5 an hour).
5. Clean up: log in as the test account → My account → Close account (the row stays, the data is replaced), or suspend it from `/admin/staff`. Nothing is deleted.
6. Do not register a real facility during the test: that starts the owner fee flow (an unpaid request is cleaned up after 14 days).

## Limits to know
- A free Gmail account allows about 500 recipients a day (check Google's page); each sign-up uses 1 or 2 emails. Mail from a free Gmail address can land in spam.
- The free Render API sleeps after 15 minutes: the first request after a pause is slow.

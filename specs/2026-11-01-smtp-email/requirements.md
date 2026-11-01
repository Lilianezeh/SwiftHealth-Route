# Free email for sign-up: plain SMTP beside Resend

Requirements: **FR-48** (sign-up needs an email code), **FR-54** (forgot password by email), **FR-22** (staff alerts), **NFR-06**, **NFR-07** (no secret or address in a log).
Written 2026-11-01 from the owner's request: open sign-up for free, without buying a domain.

## What the owner asked for
- A free email option alongside Resend: **plain SMTP with STARTTLS** (a Gmail account with an app password: `smtp.gmail.com`, port 587).
- Settings `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `EMAIL_FROM`; never logged or printed.
- **SMTP is used when Resend is not set up.**
- `signup_open` becomes true when `SIGNUP_ENABLED=true` and **either** Resend **or** SMTP is configured.
- The rule "phone confirmed by an admin's call" stays (decision D20): Termii is not needed.

## What was built
| Part | What it does |
| --- | --- |
| `integrations/smtp.py` | `send_email` through `smtplib` in a thread: connect, EHLO, **STARTTLS**, EHLO, login, send, quit. The server's certificate is checked against the system's trusted list. A server that does not offer STARTTLS gets **no password and no message**. A line break in a subject cannot add a header. An error names only its class (`Could not send through SMTP (SMTPAuthenticationError).`): never the password, the user name, the sender or the address. Nothing is logged. |
| `integrations/resend.py` | `send_email` stays the one function every service calls. Resend if it is set up; else SMTP if it is set up; else the old behaviour (an ordinary email is skipped with a warning; an account code is logged in development and refused elsewhere). |
| `integrations/email_errors.py` | `EmailSendError` and `EmailNotConfiguredError`, moved here so the two files do not import each other. Still importable from `resend`. |
| `core/config.py` | The five settings (`SMTP_PORT` default 587) and the properties `resend_configured`, `smtp_configured`, `email_sender`, `email_configured`. |
| `signup_service.signup_is_open` | Outside development: `SIGNUP_ENABLED` and `email_configured`. Development is unchanged (open when the setting is on). |
| `account_service` (forgot password), `auth_service.code_channel` | Use `email_configured`: with SMTP and no Termii, a login code goes by email. |

"Configured" means all of: host, user name, password and a sender. Half of it is none of it. The sender is `EMAIL_FROM`; if that is empty and the user name is an email address, the user name is the sender.

## Decisions
| ID | Decision |
| --- | --- |
| M1 | Resend wins when both are set up. |
| M2 | STARTTLS only (the usual port 587). No implicit TLS on 465 and no plain connection: if the server will not encrypt, nothing is sent. |
| M3 | No new package: Python's `smtplib` and `email`. The tests use a fake SMTP server written for them (`tests/fake_smtp.py`, with a throw-away certificate). |
| M4 | `SMTP_PORT` can be any port that speaks STARTTLS, for example **2525**, which several mail services offer (see the warning). |

## WARNING found while building: Render's free web service blocks SMTP
Render's changelog (16 Sep 2025, live by 26 Sep 2025): **free web services block outbound traffic to SMTP ports 25, 465 and 587**; "to continue sending traffic to an SMTP port, you can upgrade your free web service to any paid instance type" (<https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports>). Our API is on the free plan (`render.yaml`). So **Gmail on port 587 will not connect from the production API.** Gmail offers only 587 and 465, so Gmail needs a paid API instance. What works without paying: an SMTP service that accepts STARTTLS on a port Render does not block, such as **2525** (Brevo's documentation lists 587 or 2525; Mailjet and others offer 2525 too; **check the provider's page for the free plan, the port and whether a sender address is enough without a domain**: I could not confirm that for Brevo). The code needs no change for that: set `SMTP_HOST`, `SMTP_PORT=2525`, the provider's login and key. Another way is an email service with an HTTPS API (not blocked), which would be a new integration like Resend's.

## Not changed
Resend, the sign-up rules, the phone confirmation by an admin's call, the code limits, and every message text.

# Plan: free email by SMTP

Branch `feature/smtp-email`, one draft pull request. Requirements: [requirements.md](requirements.md).

- [x] Tests first: `tests/fake_smtp.py` (a fake SMTP server with real STARTTLS), `tests/unit/test_smtp.py` (TLS before login, no password to a server without STARTTLS, the certificate is checked, refusals and unreachable servers leak nothing, no header injection, non-ASCII body, the sender fallback, the settings), `tests/unit/test_email_choice.py` (Resend first, SMTP second, nothing third; half a setting is none; account codes; the login-code channel; forgot password), `tests/integration/test_meta.py` (`signup_open` with SMTP alone and no Termii).
- [x] Code: `integrations/smtp.py`, `integrations/email_errors.py`, `integrations/resend.py`, `core/config.py`, `signup_service.py`, `account_service.py`, `auth_service.py`.
- [x] Docs: `.env.example`, `api-spec.md` (4c), `LOG.md`, this folder.
- [ ] Owner: pick an email route that works from Render (see the warning in requirements.md), then the Render steps in validation.md.

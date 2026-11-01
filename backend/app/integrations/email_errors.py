"""The errors of sending an email, shared by integrations/resend.py and integrations/smtp.py.

They live here because the two files would otherwise import each other. Callers import them from
`app.integrations.resend`, where they have always been."""


class EmailSendError(Exception):
    """The email could not be sent. The message never contains a key, a password or an address."""


class EmailNotConfiguredError(EmailSendError):
    """A required email (an account code) cannot be sent: no Resend and no SMTP, outside development."""

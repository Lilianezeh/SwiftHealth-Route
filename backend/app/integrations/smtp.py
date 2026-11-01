"""Plain SMTP with STARTTLS: a free way to send the account emails.
Requirements: FR-48, FR-54, NFR-06, NFR-07. Spec: specs/2026-11-01-smtp-email/.

Made for a Gmail account with an app password (smtp.gmail.com, port 587), and works with any
server that offers STARTTLS. It is used when Resend is not set up (integrations/resend.py decides).
The steps are the standard ones of Python's `smtplib`: connect, EHLO, STARTTLS, EHLO, login, send,
quit. The password is sent ONLY after the connection is encrypted and the server's certificate was
checked against the system's trusted list; a server that does not offer STARTTLS gets no password
and no message. Not tested against Gmail itself: the tests use a fake server on this machine.

The settings are SMTP_HOST, SMTP_PORT (587), SMTP_USERNAME, SMTP_PASSWORD and EMAIL_FROM. Nothing
here is logged, and an error says only the class of the problem (the text of an SMTP error can
hold the address or the user name).
"""

import smtplib
import ssl
from email.message import EmailMessage

from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.integrations.email_errors import EmailSendError

TIMEOUT_SECONDS = 15.0  # our choice: connecting, the login and the sending each get this long


class StartTlsNotOfferedError(Exception):
    """The server does not offer STARTTLS, so the login would travel in the clear: nothing is sent."""


def tls_context() -> ssl.SSLContext:
    """The rule for the server's certificate: the system's trusted list and the host name."""
    return ssl.create_default_context()


def _send_now(to: str, subject: str, body: str, context: ssl.SSLContext) -> None:
    """The blocking part, run in a thread. Raises smtplib, OSError or ValueError errors."""
    message = EmailMessage()
    message["From"] = settings.email_sender
    message["To"] = to
    message["Subject"] = subject  # a line break in a header value is a ValueError: no header can be added
    message.set_content(body)
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=TIMEOUT_SECONDS) as connection:
        connection.ehlo()
        if not connection.has_extn("starttls"):
            raise StartTlsNotOfferedError
        connection.starttls(context=context)
        connection.ehlo()  # the extensions are asked for again, now over TLS
        connection.login(settings.smtp_username, settings.smtp_password)
        connection.send_message(message)


async def send_email(to: str, subject: str, body: str) -> None:
    """Sends a plain-text email through the SMTP server of the settings.

    Raises EmailSendError, naming only the class of the problem.

    `async def` because it waits for the network: the blocking `smtplib` runs in a thread (FastAPI's
    `run_in_threadpool`) so the event loop is never held up."""
    try:
        await run_in_threadpool(_send_now, to, subject, body, tls_context())
    except (smtplib.SMTPException, OSError, ValueError, StartTlsNotOfferedError) as error:
        # `from None`: the original error is dropped; its text (and so a traceback) can hold the address.
        raise EmailSendError(f"Could not send through SMTP ({type(error).__name__}).") from None

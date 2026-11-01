"""Tests for integrations/smtp.py: plain SMTP with STARTTLS, a free way to send the account emails
(a Gmail account with an app password: smtp.gmail.com, port 587).
Requirements: FR-48, FR-54, NFR-06, NFR-07. Spec: specs/2026-11-01-smtp-email/.

A fake SMTP server (tests/fake_smtp.py) runs on this machine with a throw-away certificate, so
nothing is sent anywhere. What the tests hold: the message arrives over TLS; the login (username
and password) is sent only after TLS began; a server that does not offer STARTTLS gets no password;
the certificate is checked; and no error text and no log line holds the password, the username,
the sender or the address. Every name, address and password here is fictional.
"""

import email
import logging
import ssl
from collections.abc import AsyncIterator
from email import policy
from pathlib import Path

import pytest

from app.core.config import settings
from app.integrations import smtp
from app.integrations.resend import EmailSendError
from tests.fake_smtp import FakeSmtpServer, make_certificate

pytestmark = pytest.mark.anyio

USERNAME = "sender.account@example.test"
PASSWORD = "fictional-app-password-1234"
SENDER = "SwiftHealth Route <noreply@example.test>"
RECIPIENT = "ada.recipient@example.test"


async def running(tmp_path: Path, **options: bool) -> FakeSmtpServer:
    certificate, key = make_certificate(tmp_path)
    server = FakeSmtpServer(certificate, key, **options)
    await server.start()
    return server


@pytest.fixture
async def server(tmp_path: Path) -> AsyncIterator[FakeSmtpServer]:
    made = await running(tmp_path)
    yield made
    await made.stop()


@pytest.fixture(autouse=True)
def configured(monkeypatch: pytest.MonkeyPatch, server: FakeSmtpServer) -> None:
    """SMTP set up for the fake server, which this client trusts (the real default would not)."""
    monkeypatch.setattr(settings, "smtp_host", "127.0.0.1")
    monkeypatch.setattr(settings, "smtp_port", server.port)
    monkeypatch.setattr(settings, "smtp_username", USERNAME)
    monkeypatch.setattr(settings, "smtp_password", PASSWORD)
    monkeypatch.setattr(settings, "email_from", SENDER)
    monkeypatch.setattr(smtp, "tls_context", lambda: server.trust)


async def test_a_message_arrives_over_tls_from_the_sender_to_the_recipient(server):
    await smtp.send_email(RECIPIENT, "Your code", "Your code is 482913.")

    received = server.received
    assert received.tls_started is True
    assert received.mail_from == "noreply@example.test"
    assert received.recipients == [RECIPIENT]
    message = email.message_from_bytes(received.message_bytes, policy=policy.default)
    assert message["Subject"] == "Your code"
    assert message["From"] == SENDER
    assert message["To"] == RECIPIENT
    assert message.get_content().strip() == "Your code is 482913."
    assert received.commands[-1] == "QUIT"


async def test_the_login_is_sent_only_after_tls_began_and_is_not_in_the_message(server):
    await smtp.send_email(RECIPIENT, "Hello", "Plain text.")

    received = server.received
    assert received.password_sent_before_tls is False
    assert (received.username, received.password) == (USERNAME, PASSWORD)
    assert received.commands.index("STARTTLS") < received.commands.index("AUTH PLAIN <hidden>")
    assert PASSWORD not in received.message and USERNAME not in received.message.replace(SENDER, "")


async def test_a_server_without_starttls_gets_no_password_and_no_message(tmp_path, monkeypatch):
    plain = await running(tmp_path, offer_starttls=False)
    monkeypatch.setattr(settings, "smtp_port", plain.port)
    try:
        with pytest.raises(EmailSendError):
            await smtp.send_email(RECIPIENT, "Hello", "Plain text.")
    finally:
        await plain.stop()

    assert plain.received.password_sent_before_tls is False
    assert plain.received.password is None and plain.received.message == ""
    assert not any(command.startswith("AUTH") for command in plain.received.commands)


async def test_the_certificate_is_checked_a_server_the_client_does_not_trust_gets_nothing(
    server, monkeypatch
):
    monkeypatch.setattr(
        smtp, "tls_context", ssl.create_default_context
    )  # the real rule: the system's trusted list

    with pytest.raises(EmailSendError):
        await smtp.send_email(RECIPIENT, "Hello", "Plain text.")

    assert server.received.password is None and server.received.message == ""


async def test_a_non_ascii_body_arrives_intact(server):
    await smtp.send_email(RECIPIENT, "Receipt ₦10,000.00", "Amount: ₦10,000.00")

    message = email.message_from_bytes(server.received.message_bytes, policy=policy.default)
    assert message["Subject"] == "Receipt ₦10,000.00"
    assert message.get_content().strip() == "Amount: ₦10,000.00"


# --- failures: an error that says what class of problem it was, and nothing else ---


async def failing_run(server_options: dict[str, bool], tmp_path: Path, monkeypatch, caplog) -> EmailSendError:
    broken = await running(tmp_path, **server_options)
    monkeypatch.setattr(settings, "smtp_port", broken.port)
    monkeypatch.setattr(smtp, "tls_context", lambda: broken.trust)
    caplog.set_level(logging.DEBUG)
    try:
        with pytest.raises(EmailSendError) as raised:
            await smtp.send_email(RECIPIENT, "Hello", "Plain text.")
    finally:
        await broken.stop()
    return raised.value


@pytest.mark.parametrize(
    "options", [{"reject_login": True}, {"reject_recipient": True}, {"offer_starttls": False}]
)
async def test_a_refusal_is_an_error_without_the_password_the_username_the_sender_or_the_address(
    tmp_path, monkeypatch, caplog, options
):
    error = await failing_run(options, tmp_path, monkeypatch, caplog)

    shown = str(error) + caplog.text
    for secret in (PASSWORD, USERNAME, "noreply@example.test", RECIPIENT, "ada.recipient"):
        assert secret not in shown, secret


async def test_a_server_that_cannot_be_reached_is_an_error_naming_only_the_class(monkeypatch, caplog):
    monkeypatch.setattr(settings, "smtp_port", 1)  # nothing listens there
    caplog.set_level(logging.DEBUG)

    with pytest.raises(EmailSendError) as raised:
        await smtp.send_email(RECIPIENT, "Hello", "Plain text.")

    assert "ConnectionRefusedError" in str(raised.value)
    for secret in (PASSWORD, USERNAME, RECIPIENT, "127.0.0.1"):
        assert secret not in str(raised.value) + caplog.text


@pytest.mark.parametrize("subject", ["Hello\r\nBcc: someone.else@example.test", "Hello\nX-Evil: 1"])
async def test_a_subject_cannot_add_a_header_and_nothing_is_sent(server, subject):
    with pytest.raises(EmailSendError):
        await smtp.send_email(RECIPIENT, subject, "Plain text.")

    assert server.received.message == "" and server.received.recipients == []


# --- the sender ---


async def test_with_no_sender_set_the_username_is_the_sender_when_it_is_an_address(server, monkeypatch):
    monkeypatch.setattr(settings, "email_from", "")

    await smtp.send_email(RECIPIENT, "Hello", "Plain text.")

    assert server.received.mail_from == USERNAME


async def test_the_settings_say_when_smtp_is_set_up(monkeypatch):
    assert settings.smtp_configured is True
    assert settings.email_sender == SENDER
    for name in ("smtp_host", "smtp_username", "smtp_password"):
        with monkeypatch.context() as changed:
            changed.setattr(settings, name, "")
            assert settings.smtp_configured is False, name
    with monkeypatch.context() as changed:
        changed.setattr(settings, "email_from", "")
        assert (settings.smtp_configured, settings.email_sender) == (True, USERNAME)
    with (
        monkeypatch.context() as changed
    ):  # no sender, and a username that is no address: nothing to send from
        changed.setattr(settings, "email_from", "")
        changed.setattr(settings, "smtp_username", "not-an-address")
        assert settings.smtp_configured is False

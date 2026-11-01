"""Which way an email goes: Resend, SMTP, or nowhere. Requirements: FR-22, FR-48, NFR-06, NFR-07.
Spec: specs/2026-11-01-smtp-email/.

`resend.send_email` is the one function every service calls. Resend is used when it is set up
(RESEND_API_KEY and RESEND_FROM_EMAIL); when it is not, SMTP is used if it is set up (SMTP_HOST,
SMTP_USERNAME, SMTP_PASSWORD and a sender); when neither is, an ordinary email is skipped with a
warning and an account code is logged in development or refused elsewhere, exactly as before.
Resend answers are mocked with httpx.MockTransport and SMTP goes to a fake server on this machine.
Every address, key and password here is fictional.
"""

import json
import logging
from collections.abc import AsyncIterator
from pathlib import Path

import httpx
import pytest

from app.core.config import settings
from app.integrations import resend, smtp
from tests.fake_smtp import FakeSmtpServer, make_certificate

pytestmark = pytest.mark.anyio

RECIPIENT = "ada.recipient@example.test"


@pytest.fixture
async def server(tmp_path: Path) -> AsyncIterator[FakeSmtpServer]:
    certificate, key = make_certificate(tmp_path)
    made = FakeSmtpServer(certificate, key)
    await made.start()
    yield made
    await made.stop()


@pytest.fixture(autouse=True)
def nothing_set_up(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in (
        "resend_api_key",
        "resend_from_email",
        "smtp_host",
        "smtp_username",
        "smtp_password",
        "email_from",
    ):
        monkeypatch.setattr(settings, name, "")
    monkeypatch.setattr(settings, "app_env", "production")


def set_up_smtp(monkeypatch: pytest.MonkeyPatch, server: FakeSmtpServer) -> None:
    monkeypatch.setattr(settings, "smtp_host", "127.0.0.1")
    monkeypatch.setattr(settings, "smtp_port", server.port)
    monkeypatch.setattr(settings, "smtp_username", "sender.account@example.test")
    monkeypatch.setattr(settings, "smtp_password", "fictional-app-password-1234")
    monkeypatch.setattr(settings, "email_from", "SwiftHealth Route <noreply@example.test>")
    monkeypatch.setattr(smtp, "tls_context", lambda: server.trust)


def set_up_resend(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "resend_api_key", "re_fictional_key")
    monkeypatch.setattr(settings, "resend_from_email", "noreply@resend.example.test")


def resend_client() -> tuple[httpx.AsyncClient, list[dict]]:
    sent: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        sent.append(json.loads(request.content))
        return httpx.Response(200, json={"id": "fictional"})

    return httpx.AsyncClient(transport=httpx.MockTransport(handler)), sent


async def test_resend_is_used_when_it_is_set_up_even_if_smtp_is_too(monkeypatch, server):
    set_up_resend(monkeypatch)
    set_up_smtp(monkeypatch, server)
    client, sent = resend_client()

    await resend.send_email(RECIPIENT, "Hello", "Plain text.", client=client)

    assert [message["to"] for message in sent] == [[RECIPIENT]]
    assert server.received.commands == []  # SMTP was not even called


async def test_smtp_is_used_when_resend_is_not_set_up(monkeypatch, server):
    set_up_smtp(monkeypatch, server)

    await resend.send_email(RECIPIENT, "Hello", "Plain text.")

    assert server.received.recipients == [RECIPIENT]


@pytest.mark.parametrize("missing", ["resend_api_key", "resend_from_email"])
async def test_half_of_resend_is_not_resend_so_smtp_is_used(monkeypatch, server, missing):
    set_up_resend(monkeypatch)
    monkeypatch.setattr(settings, missing, "")
    set_up_smtp(monkeypatch, server)

    await resend.send_email(RECIPIENT, "Hello", "Plain text.")

    assert server.received.recipients == [RECIPIENT]


@pytest.mark.parametrize("missing", ["smtp_host", "smtp_username", "smtp_password"])
async def test_half_of_smtp_is_not_smtp_an_ordinary_email_is_skipped_with_a_warning(
    monkeypatch, server, caplog, missing
):
    set_up_smtp(monkeypatch, server)
    monkeypatch.setattr(settings, missing, "")
    caplog.set_level(logging.WARNING)

    await resend.send_email(RECIPIENT, "Hello", "Plain text.")  # does not raise

    assert server.received.commands == []
    assert "no email was sent" in caplog.text
    assert RECIPIENT not in caplog.text


async def test_an_account_code_goes_by_smtp_when_that_is_all_there_is_even_outside_development(
    monkeypatch, server
):
    set_up_smtp(monkeypatch, server)

    await resend.send_email(RECIPIENT, "Your code", "Your code is 482913.", required=True)

    assert "482913" in server.received.message


async def test_an_account_code_with_nothing_set_up_is_refused_outside_development_and_not_logged(
    monkeypatch, caplog
):
    caplog.set_level(logging.DEBUG)

    with pytest.raises(resend.EmailNotConfiguredError):
        await resend.send_email(RECIPIENT, "Your code", "Your code is 482913.", required=True)

    assert "482913" not in caplog.text and RECIPIENT not in caplog.text


async def test_in_development_with_nothing_set_up_the_code_is_logged_as_before(monkeypatch, caplog):
    monkeypatch.setattr(settings, "app_env", "development")
    caplog.set_level(logging.WARNING)

    await resend.send_email(RECIPIENT, "Your code", "Your code is 482913.", required=True)

    assert "482913" in caplog.text


async def test_a_failing_smtp_is_an_email_send_error_so_the_callers_that_catch_it_keep_working(
    monkeypatch, server
):
    set_up_smtp(monkeypatch, server)
    monkeypatch.setattr(settings, "smtp_port", 1)

    with pytest.raises(resend.EmailSendError):
        await resend.send_email(RECIPIENT, "Hello", "Plain text.")


async def test_a_login_code_goes_by_email_when_only_smtp_is_set_up_and_there_is_no_termii(
    monkeypatch, server
):
    from app.services import auth_service

    monkeypatch.setattr(settings, "termii_api_key", "")
    assert auth_service.code_channel() == "sms"  # nothing set up: in development this only logs the code
    set_up_smtp(monkeypatch, server)
    assert auth_service.code_channel() == "email"
    monkeypatch.setattr(settings, "termii_api_key", "fictional-termii-key")
    assert auth_service.code_channel() == "sms"  # Termii first, as before


async def test_the_forgot_password_email_can_be_sent_with_smtp_alone(monkeypatch, server):
    from app.services import account_service

    assert account_service._email_can_be_sent() is False  # production, nothing set up
    set_up_smtp(monkeypatch, server)
    assert account_service._email_can_be_sent() is True


async def test_the_settings_say_which_way_is_set_up(monkeypatch, server):
    assert (settings.resend_configured, settings.smtp_configured, settings.email_configured) == (
        False,
        False,
        False,
    )
    set_up_smtp(monkeypatch, server)
    assert (settings.resend_configured, settings.smtp_configured, settings.email_configured) == (
        False,
        True,
        True,
    )
    set_up_resend(monkeypatch)
    assert settings.resend_configured is True and settings.email_configured is True

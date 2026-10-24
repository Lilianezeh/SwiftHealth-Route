"""The email for an account code: Resend with no key, and the texts.
Requirements: FR-48, FR-54, NFR-06, NFR-07. Spec: specs/2026-10-23-accounts-and-facility-ownership/ (D2).

With no Resend key: development logs the message (the code) so a developer can use it, like Termii; any
other environment refuses, so an account is never made that nobody can confirm. The staff alerts (FR-22)
keep their old behaviour: nothing sent, a warning, no error.
"""

import logging

import pytest

from app.core.config import settings
from app.core.security import EMAIL_CONFIRM_PURPOSE, PASSWORD_RESET_PURPOSE
from app.integrations.resend import EmailNotConfiguredError, EmailSendError, send_email
from app.services import account_mail_service

pytestmark = pytest.mark.anyio


@pytest.fixture
def no_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "resend_api_key", "")
    monkeypatch.setattr(settings, "resend_from_email", "")


async def test_a_required_email_with_no_key_in_development_is_logged_with_its_text(
    no_key: None, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setattr(settings, "app_env", "development")

    with caplog.at_level(logging.WARNING):
        await send_email("ada@example.test", "Subject", "Your code is 123456.", required=True)

    assert "Your code is 123456." in caplog.text


async def test_a_required_email_with_no_key_outside_development_is_refused(
    no_key: None, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setattr(settings, "app_env", "production")

    with pytest.raises(EmailNotConfiguredError):
        await send_email("ada@example.test", "Subject", "Your code is 123456.", required=True)

    assert "123456" not in caplog.text
    assert "ada@example.test" not in caplog.text


def test_the_refusal_is_an_email_send_error_so_old_callers_that_catch_it_still_work() -> None:
    assert issubclass(EmailNotConfiguredError, EmailSendError)


async def test_an_alert_with_no_key_still_sends_nothing_and_never_logs_the_text(
    no_key: None, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setattr(settings, "app_env", "production")

    with caplog.at_level(logging.WARNING):
        await send_email("editor@example.test", "Subject", "Secret body text")  # not required: as before

    assert "Secret body text" not in caplog.text


@pytest.mark.parametrize(
    ("purpose", "words"),
    [(EMAIL_CONFIRM_PURPOSE, "confirm"), (PASSWORD_RESET_PURPOSE, "reset")],
)
async def test_the_code_email_holds_the_code_the_time_it_lasts_and_no_address_or_advice(
    monkeypatch: pytest.MonkeyPatch, purpose: str, words: str
) -> None:
    sent: list[tuple] = []

    async def record(to: str, subject: str, body: str, **options: object) -> None:
        sent.append((to, subject, body, options))

    monkeypatch.setattr(account_mail_service.resend, "send_email", record)

    await account_mail_service.send_email_code("ada@example.test", "004821", purpose)

    [(to, subject, body, options)] = sent
    assert to == "ada@example.test"
    assert "004821" in body
    assert "15 minutes" in body
    assert words in (subject + body).lower()
    assert options == {"required": True}
    assert "ada@example.test" not in body
    assert "http" not in body  # a code, not a link
    assert "SwiftHealth Route" in body


async def test_an_unknown_purpose_is_refused() -> None:
    with pytest.raises(ValueError):
        await account_mail_service.send_email_code("ada@example.test", "004821", "something_else")

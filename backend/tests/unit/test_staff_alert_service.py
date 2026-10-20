"""Tests for services/staff_alert_service.py and integrations/resend.py. Requirements: FR-22.
Decision B6 in specs/2026-10-20-reports/requirements.md. Email and SMS are replaced by recorders.
HTTP to Resend is mocked with httpx.MockTransport. Addresses and numbers are fictional.
"""

import json
import logging

import httpx
import pytest

from app.core.config import settings
from app.integrations import resend, termii
from app.integrations.resend import EmailSendError, send_email
from app.services import staff_alert_service
from app.services.staff_alert_service import StaffAlert, build_alert_texts, send_alerts

pytestmark = pytest.mark.anyio

API_KEY = "re_test_key_not_real"
FROM_ADDRESS = "alerts@example.test"


@pytest.fixture
def recorders(monkeypatch: pytest.MonkeyPatch):
    emails: list[tuple[str, str, str]] = []
    texts: list[tuple[str, str]] = []

    async def record_email(to: str, subject: str, body: str) -> None:
        emails.append((to, subject, body))

    async def record_sms(phone: str, message: str) -> None:
        texts.append((phone, message))

    monkeypatch.setattr(staff_alert_service.resend, "send_email", record_email)
    monkeypatch.setattr(staff_alert_service.termii, "send_sms", record_sms)
    return emails, texts


def test_the_texts_hold_the_listing_name_and_the_count_and_nothing_about_the_reporter() -> None:
    subject, body, sms = build_alert_texts("Night Pharmacy")
    for text in (subject, body, sms):
        assert "Night Pharmacy" in text
    assert "2" in body
    assert "comment" not in body.lower() and "phone" not in body.lower()


async def test_every_editor_gets_an_email_and_every_admin_an_sms(recorders) -> None:
    emails, texts = recorders
    alert = StaffAlert("Night Pharmacy", ["editor@example.test", "admin@example.test"], ["+2340000000903"])

    await send_alerts(alert)

    assert [to for to, _, _ in emails] == ["editor@example.test", "admin@example.test"]
    assert [phone for phone, _ in texts] == ["+2340000000903"]


async def test_a_failed_email_does_not_stop_the_others_or_the_sms_and_the_log_holds_no_address(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    texts: list[str] = []

    async def failing_email(to: str, subject: str, body: str) -> None:
        raise EmailSendError("Resend answered with HTTP 500.")

    async def record_sms(phone: str, message: str) -> None:
        texts.append(phone)

    monkeypatch.setattr(staff_alert_service.resend, "send_email", failing_email)
    monkeypatch.setattr(staff_alert_service.termii, "send_sms", record_sms)
    alert = StaffAlert("Night Pharmacy", ["a@example.test", "b@example.test"], ["+2340000000903"])

    with caplog.at_level(logging.WARNING):
        await send_alerts(alert)

    assert texts == ["+2340000000903"]
    assert "a@example.test" not in caplog.text and "+2340000000903" not in caplog.text


async def test_a_failed_sms_is_logged_without_the_number(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    async def ignore_email(to: str, subject: str, body: str) -> None:
        return None

    async def failing_sms(phone: str, message: str) -> None:
        raise termii.SmsSendError("Termii answered with HTTP 500.")

    monkeypatch.setattr(staff_alert_service.resend, "send_email", ignore_email)
    monkeypatch.setattr(staff_alert_service.termii, "send_sms", failing_sms)

    with caplog.at_level(logging.WARNING):
        await send_alerts(StaffAlert("Night Pharmacy", [], ["+2340000000903"]))

    assert "+2340000000903" not in caplog.text
    assert "staff alert" in caplog.text.lower()


# --- the Resend call ---


@pytest.fixture
def live_resend(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "resend_api_key", API_KEY)
    monkeypatch.setattr(settings, "resend_from_email", FROM_ADDRESS)


def mock_client(handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


async def test_without_a_key_nothing_is_sent_and_nothing_personal_is_logged(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setattr(settings, "resend_api_key", "")
    calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(200, json={"id": "x"})

    with caplog.at_level(logging.INFO):
        await send_email("editor@example.test", "Subject", "Body", client=mock_client(handler))

    assert calls == []
    assert "editor@example.test" not in caplog.text


async def test_without_a_from_address_nothing_is_sent(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "resend_api_key", API_KEY)
    monkeypatch.setattr(settings, "resend_from_email", "")
    calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(200, json={"id": "x"})

    await send_email("editor@example.test", "Subject", "Body", client=mock_client(handler))

    assert calls == []


async def test_with_a_key_it_posts_the_documented_fields_with_a_bearer_token(live_resend) -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json={"id": "email-id"})

    await send_email("editor@example.test", "Subject", "Body", client=mock_client(handler))

    [request] = seen
    assert str(request.url) == "https://api.resend.com/emails"
    assert request.headers["authorization"] == f"Bearer {API_KEY}"
    assert json.loads(request.content) == {
        "from": FROM_ADDRESS,
        "to": ["editor@example.test"],
        "subject": "Subject",
        "text": "Body",
    }


async def test_an_error_answer_raises_an_error_that_holds_no_key_or_address(live_resend) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(422, json={"message": "Invalid to field editor@example.test"})

    with pytest.raises(EmailSendError) as error:
        await send_email("editor@example.test", "Subject", "Body", client=mock_client(handler))

    assert API_KEY not in str(error.value) and "editor@example.test" not in str(error.value)
    assert "422" in str(error.value)


async def test_a_network_failure_raises_the_same_kind_of_error(live_resend) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("boom with https://api.resend.com/emails")

    with pytest.raises(EmailSendError) as error:
        await send_email("editor@example.test", "Subject", "Body", client=mock_client(handler))

    assert "api.resend.com" not in str(error.value)


def test_the_module_is_the_one_the_service_uses() -> None:
    assert staff_alert_service.resend is resend

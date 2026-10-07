"""Tests for integrations/termii.py. Requirements: FR-30 (one-time code by SMS), NFR-06 (no secrets in logs).

HTTP is mocked with httpx.MockTransport, so no test calls Termii. Numbers are fictional (+2340...).
"""
import json
import logging

import httpx
import pytest

from app.core.config import Settings, settings
from app.integrations.termii import SmsSendError, mask_phone, send_sms, to_termii_number

PHONE = "+2340000000001"
PHONE_DIGITS = "2340000000001"
MASKED_PHONE = "+234******0001"
CODE = "482913"
MESSAGE = f"Your SwiftHealth login code is {CODE}."
API_KEY = "test-key-not-real-123"
BASE_URL = "https://termii.test"
SECRETS = (API_KEY, CODE, PHONE, PHONE_DIGITS)  # none of these may appear in a log or an error message

SUCCESS_BODY = {"code": "ok", "message_id": "301754405", "message": "Successfully Sent", "balance": 10.5}


class RecordingTransport:
    """A fake Termii: records each request and answers with the response (or error) the test chose."""

    def __init__(self, response: httpx.Response | Exception) -> None:
        self.requests: list[httpx.Request] = []
        self.response = response

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if isinstance(self.response, Exception):
            raise self.response
        return self.response

    def client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(transport=httpx.MockTransport(self.handler))


@pytest.fixture
def live_termii(monkeypatch):
    """Settings as on a real account: key, base URL and the default channel."""
    monkeypatch.setattr(settings, "termii_api_key", API_KEY)
    monkeypatch.setattr(settings, "termii_base_url", BASE_URL)
    monkeypatch.setattr(settings, "termii_sender_id", "SwiftHealth")
    monkeypatch.setattr(settings, "termii_channel", "dnd")


def assert_no_secrets(text: str) -> None:
    for secret in SECRETS:
        assert secret not in text, f"{secret!r} leaked"


# --- pure helpers ---

def test_phone_is_sent_without_the_plus_sign():
    assert to_termii_number(PHONE) == PHONE_DIGITS


def test_mask_phone_keeps_prefix_and_last_four():
    assert mask_phone(PHONE) == MASKED_PHONE


# --- no key: local development ---

@pytest.mark.anyio
async def test_without_key_logs_code_and_makes_no_http_call(monkeypatch, caplog):
    monkeypatch.setattr(settings, "termii_api_key", "")
    fake_termii = RecordingTransport(httpx.Response(200, json=SUCCESS_BODY))
    with caplog.at_level(logging.WARNING):
        await send_sms(PHONE, MESSAGE, client=fake_termii.client())
    assert fake_termii.requests == []
    assert CODE in caplog.text  # the one allowed place a code is logged: no key, local development
    assert MASKED_PHONE in caplog.text
    assert API_KEY not in caplog.text


# --- with a key ---

@pytest.mark.anyio
async def test_with_key_posts_to_termii(live_termii, monkeypatch):
    monkeypatch.setattr(settings, "termii_base_url", BASE_URL + "/")  # a trailing slash must not double up
    fake_termii = RecordingTransport(httpx.Response(200, json=SUCCESS_BODY))
    await send_sms(PHONE, MESSAGE, client=fake_termii.client())
    assert len(fake_termii.requests) == 1
    request = fake_termii.requests[0]
    assert request.method == "POST"
    assert str(request.url) == "https://termii.test/api/sms/send"
    assert json.loads(request.content) == {
        "api_key": API_KEY,
        "to": PHONE_DIGITS,
        "from": "SwiftHealth",
        "sms": MESSAGE,
        "type": "plain",
        "channel": "dnd",
    }


def test_the_default_channel_is_dnd():
    assert Settings.model_fields["termii_channel"].default == "dnd"


@pytest.mark.anyio
async def test_channel_comes_from_the_setting(live_termii, monkeypatch):
    monkeypatch.setattr(settings, "termii_channel", "generic")
    fake_termii = RecordingTransport(httpx.Response(200, json=SUCCESS_BODY))
    await send_sms(PHONE, MESSAGE, client=fake_termii.client())
    assert json.loads(fake_termii.requests[0].content)["channel"] == "generic"


@pytest.mark.anyio
async def test_key_without_base_url_raises_a_clear_error(live_termii, monkeypatch):
    monkeypatch.setattr(settings, "termii_base_url", "")
    fake_termii = RecordingTransport(httpx.Response(200, json=SUCCESS_BODY))
    with pytest.raises(SmsSendError, match="TERMII_BASE_URL"):
        await send_sms(PHONE, MESSAGE, client=fake_termii.client())
    assert fake_termii.requests == []


# --- failures: Termii documents the status codes but not an error body ---

# Each failing answer echoes the secrets in its body, to prove a response body is never copied into an error
# or a log.
FAILURES = {
    "bad_request": httpx.Response(400, json={"message": f"bad number {PHONE_DIGITS} key {API_KEY} {CODE}"}),
    "unauthorized": httpx.Response(401, json={"message": f"Invalid API key {API_KEY}"}),
    "too_many_requests": httpx.Response(429, json={"message": "slow down"}),
    "server_error": httpx.Response(500, text=f"boom {API_KEY}"),
    "code_not_ok": httpx.Response(200, json={"code": "error", "message": f"for {PHONE_DIGITS} {CODE}"}),
    "not_json": httpx.Response(200, text="<html>gateway</html>"),
    "network_error": httpx.ConnectError(f"cannot connect {API_KEY}"),
}


@pytest.mark.anyio
@pytest.mark.parametrize("failure", FAILURES)
async def test_a_failed_send_raises_sms_send_error(live_termii, failure):
    fake_termii = RecordingTransport(FAILURES[failure])
    with pytest.raises(SmsSendError):
        await send_sms(PHONE, MESSAGE, client=fake_termii.client())


@pytest.mark.anyio
@pytest.mark.parametrize("failure", FAILURES)
async def test_error_messages_contain_no_secrets(live_termii, failure):
    fake_termii = RecordingTransport(FAILURES[failure])
    with pytest.raises(SmsSendError) as error:
        await send_sms(PHONE, MESSAGE, client=fake_termii.client())
    assert_no_secrets(str(error.value))


# --- NFR-06: nothing secret in the logs when a key is set ---

@pytest.mark.anyio
async def test_with_key_nothing_secret_is_logged_on_success(live_termii, caplog):
    fake_termii = RecordingTransport(httpx.Response(200, json=SUCCESS_BODY))
    with caplog.at_level(logging.DEBUG):
        await send_sms(PHONE, MESSAGE, client=fake_termii.client())
    assert_no_secrets(caplog.text)
    assert MASKED_PHONE in caplog.text  # the log still says who the message went to


@pytest.mark.anyio
@pytest.mark.parametrize("failure", FAILURES)
async def test_with_key_nothing_secret_is_logged_on_failure(live_termii, failure, caplog):
    fake_termii = RecordingTransport(FAILURES[failure])
    with caplog.at_level(logging.DEBUG), pytest.raises(SmsSendError):
        await send_sms(PHONE, MESSAGE, client=fake_termii.client())
    assert_no_secrets(caplog.text)

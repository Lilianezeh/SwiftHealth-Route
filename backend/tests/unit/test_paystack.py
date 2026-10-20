"""Tests for integrations/paystack.py. Requirements: FR-44, FR-46, NFR-06. Decisions I3, I5 and I6 in
specs/2026-10-20-providers-payments/requirements.md. HTTP is mocked with httpx.MockTransport, so no test calls
Paystack. Keys, addresses and references are fictional.
"""

import hashlib
import hmac
import json

import httpx
import pytest

from app.core.config import settings
from app.integrations import paystack

pytestmark = pytest.mark.anyio

TEST_KEY = "sk_test_not_a_real_key"
EMAIL = "provider@demo.example.com"
CALLBACK = "https://example.test/provider/payment-complete"


@pytest.fixture(autouse=True)
def test_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "paystack_secret_key", TEST_KEY)


def client_answering(status: int, body: object) -> tuple[httpx.AsyncClient, list[httpx.Request]]:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(status, json=body)

    return httpx.AsyncClient(transport=httpx.MockTransport(handler)), seen


GOOD_ANSWER = {
    "status": True,
    "message": "Authorization URL created",
    "data": {
        "authorization_url": "https://checkout.paystack.com/abc",
        "access_code": "abc",
        "reference": "SH-12-1",
    },
}


async def start(client: httpx.AsyncClient) -> paystack.StartedPayment:
    return await paystack.initialize_transaction(
        email=EMAIL,
        amount_kobo=500000,
        reference="SH-12-1",
        callback_url=CALLBACK,
        metadata={"listing_id": 12},
        client=client,
    )


async def test_initialize_posts_what_paystack_documents_and_returns_the_checkout_address() -> None:
    client, seen = client_answering(200, GOOD_ANSWER)

    started = await start(client)

    assert started == paystack.StartedPayment("https://checkout.paystack.com/abc", "SH-12-1")
    [request] = seen
    assert request.method == "POST"
    assert str(request.url) == "https://api.paystack.co/transaction/initialize"
    assert request.headers["authorization"] == f"Bearer {TEST_KEY}"
    assert json.loads(request.content) == {
        "email": EMAIL,
        "amount": 500000,
        "reference": "SH-12-1",
        "callback_url": CALLBACK,
        "metadata": {"listing_id": 12},
    }
    assert isinstance(json.loads(request.content)["amount"], int)  # kobo is a whole number, never a float


async def test_a_live_key_is_refused_before_any_request() -> None:
    settings.paystack_secret_key = "sk_live_not_a_real_key"
    client, seen = client_answering(200, GOOD_ANSWER)

    with pytest.raises(paystack.LiveKeyRefusedError):
        await start(client)

    assert seen == []


async def test_no_key_means_payments_are_not_set_up_and_nothing_is_sent() -> None:
    settings.paystack_secret_key = ""
    client, seen = client_answering(200, GOOD_ANSWER)

    with pytest.raises(paystack.PaymentsNotSetUpError):
        await start(client)

    assert seen == []


@pytest.mark.parametrize(
    ("status", "body"),
    [
        (401, {"status": False, "message": "Invalid key"}),
        (500, {"status": False, "message": f"error for {EMAIL}"}),
        (200, {"status": False, "message": "No"}),
        (200, {"status": True, "data": {}}),
        (200, {"status": True}),
    ],
)
async def test_an_answer_that_is_not_a_success_raises_an_error_that_holds_no_key_and_no_email(
    status: int, body: object
) -> None:
    client, _ = client_answering(status, body)

    with pytest.raises(paystack.PaymentStartError) as error:
        await start(client)

    assert TEST_KEY not in str(error.value)
    assert EMAIL not in str(error.value)


async def test_an_answer_that_is_not_json_raises_a_start_error() -> None:
    client = httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(200, text="<html>"))
    )

    with pytest.raises(paystack.PaymentStartError):
        await start(client)


async def test_a_network_failure_raises_a_start_error_without_the_address() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError(f"cannot reach for {EMAIL}")

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))

    with pytest.raises(paystack.PaymentStartError) as error:
        await start(client)

    assert EMAIL not in str(error.value)
    assert "ConnectError" in str(error.value)


# --- the webhook signature ---


def sign(body: bytes, key: str = TEST_KEY) -> str:
    return hmac.new(key.encode(), body, hashlib.sha512).hexdigest()


def test_a_signature_made_with_the_key_over_the_raw_body_is_valid() -> None:
    body = b'{"event":"charge.success","data":{"reference":"SH-12-1"}}'

    assert paystack.signature_is_valid(body, sign(body))


def test_a_signature_over_another_body_or_with_another_key_is_not_valid() -> None:
    body = b'{"event":"charge.success"}'

    assert not paystack.signature_is_valid(body + b" ", sign(body))
    assert not paystack.signature_is_valid(body, sign(body, "sk_test_another_key"))


@pytest.mark.parametrize("signature", [None, "", "abc", "not hex at all", "ÿ"])
def test_a_missing_or_malformed_signature_is_not_valid_and_never_raises(signature: str | None) -> None:
    assert not paystack.signature_is_valid(b"{}", signature)


def test_without_a_key_no_signature_is_valid() -> None:
    body = b"{}"
    settings.paystack_secret_key = ""

    assert not paystack.signature_is_valid(body, sign(body, ""))
    assert not paystack.signature_is_valid(body, sign(body))

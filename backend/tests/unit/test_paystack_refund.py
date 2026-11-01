"""Tests for `paystack.create_refund`. Requirements: FR-44, FR-46, NFR-06. Spec: specs/2026-10-29-owner-fee/.
HTTP is mocked with httpx.MockTransport, so no test calls Paystack. Keys and references are fictional.
"""

import json

import httpx
import pytest

from app.core.config import settings
from app.integrations import paystack

pytestmark = pytest.mark.anyio

TEST_KEY = "sk_test_not_a_real_key"


@pytest.fixture(autouse=True)
def test_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "paystack_secret_key", TEST_KEY)


def client_answering(status: int, body: object) -> tuple[httpx.AsyncClient, list[httpx.Request]]:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(status, json=body)

    return httpx.AsyncClient(transport=httpx.MockTransport(handler)), seen


async def test_a_refund_posts_the_whole_payment_reference_with_the_test_key():
    client, seen = client_answering(200, {"status": True, "message": "Refund has been queued for processing"})

    await paystack.create_refund(reference="SO-12-1730000000", client=client)

    [request] = seen
    assert (request.method, str(request.url)) == ("POST", "https://api.paystack.co/refund")
    assert request.headers["authorization"] == f"Bearer {TEST_KEY}"
    assert json.loads(request.content) == {"transaction": "SO-12-1730000000"}  # no amount: the whole payment


@pytest.mark.parametrize(
    ("status", "body"),
    [(400, {"status": False}), (500, {}), (200, {"status": False, "message": "no"}), (200, {}), (200, [])],
)
async def test_a_refund_paystack_does_not_accept_is_an_error_without_the_answer_in_it(status, body):
    client, _ = client_answering(status, body)

    with pytest.raises(paystack.RefundError) as error:
        await paystack.create_refund(reference="SO-12-1730000000", client=client)

    assert TEST_KEY not in str(error.value) and "@" not in str(error.value)


async def test_a_network_failure_is_a_refund_error_that_names_only_the_class():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("could not connect to https://api.paystack.co for me@example.test")

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))

    with pytest.raises(paystack.RefundError) as error:
        await paystack.create_refund(reference="SO-1-1", client=client)

    assert "ConnectError" in str(error.value) and "example.test" not in str(error.value)


async def test_no_key_and_a_live_key_are_refused_before_any_call(monkeypatch):
    client, seen = client_answering(200, {"status": True})

    monkeypatch.setattr(settings, "paystack_secret_key", "")
    with pytest.raises(paystack.PaymentsNotSetUpError):
        await paystack.create_refund(reference="SO-1-1", client=client)
    monkeypatch.setattr(settings, "paystack_secret_key", "sk_live_not_allowed")
    with pytest.raises(paystack.LiveKeyRefusedError):
        await paystack.create_refund(reference="SO-1-1", client=client)
    assert seen == []

"""Paystack, in TEST MODE ONLY. Requirements: FR-44, FR-46, NFR-06.
Decisions I3, I5 and I6 in specs/2026-10-20-providers-payments/requirements.md.

What this file relies on, from Paystack's documentation (https://paystack.com/docs/api/transaction/
and https://paystack.com/docs/payments/webhooks/):
- Initialize Transaction: POST https://api.paystack.co/transaction/initialize with
  `Authorization: Bearer <secret key>` and a JSON body with `email`, `amount` (kobo, an integer),
  `reference`, `callback_url` and `metadata`. The answer has `status` (true), and
  `data.authorization_url` and `data.reference`.
- A webhook has the header `x-paystack-signature`: the HMAC SHA-512, in hex, of the raw request body
  made with the secret key.
Not tested against the real service: the tests use a mock transport. Check it once with the Paystack
test dashboard.

A secret key that starts with `sk_live_` is refused before any call: nothing here can take a real payment.
No error text and no log line holds the key, the customer's email or a card detail.
"""

import hashlib
import hmac
import logging
from dataclasses import dataclass

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

INITIALIZE_URL = "https://api.paystack.co/transaction/initialize"
TIMEOUT_SECONDS = 15.0  # our choice: Paystack's page names no timeout
LIVE_KEY_PREFIX = "sk_live_"


class PaymentsNotSetUpError(Exception):
    """There is no Paystack secret key, so payments are not set up (local development)."""


class LiveKeyRefusedError(Exception):
    """The key is a live key. This app takes test payments only."""


class PaymentStartError(Exception):
    """Paystack could not be reached or did not accept the payment. The message holds no key and no email."""


@dataclass(frozen=True)
class StartedPayment:
    authorization_url: str  # where the provider pays, on Paystack's page
    reference: str


def secret_key() -> str:
    """The test secret key, or an error. The one place the key is read and checked."""
    key = settings.paystack_secret_key
    if not key:
        raise PaymentsNotSetUpError
    if key.startswith(LIVE_KEY_PREFIX):
        raise LiveKeyRefusedError
    return key


async def initialize_transaction(
    *,
    email: str,
    amount_kobo: int,
    reference: str,
    callback_url: str,
    metadata: dict[str, object],
    client: httpx.AsyncClient | None = None,
) -> StartedPayment:
    """Asks Paystack for a checkout page. `amount_kobo` is `int(price * 100)`, worked out by the caller.

    `async def` because it awaits httpx. Tests pass their own `client` (with a mocked transport).
    """
    key = secret_key()
    payload = {
        "email": email,
        "amount": amount_kobo,
        "reference": reference,
        "callback_url": callback_url,
        "metadata": metadata,
    }
    headers = {"Authorization": f"Bearer {key}"}
    sending_client = client or httpx.AsyncClient(timeout=TIMEOUT_SECONDS)
    try:
        response = await sending_client.post(INITIALIZE_URL, json=payload, headers=headers)
    except httpx.HTTPError as error:
        # Only the class of the error is used: the text of an httpx error can hold the address.
        raise PaymentStartError(f"Could not reach Paystack ({type(error).__name__}).") from error
    finally:
        if client is None:
            await sending_client.aclose()

    if not response.is_success:
        # The body is never copied: Paystack's error text can repeat the email.
        raise PaymentStartError(f"Paystack answered with HTTP {response.status_code}.")
    try:
        answer = response.json()
        data = answer["data"] if answer.get("status") is True else {}
        started = StartedPayment(authorization_url=data["authorization_url"], reference=data["reference"])
    except (ValueError, KeyError, TypeError, AttributeError):
        raise PaymentStartError("Paystack sent an answer we could not use.") from None
    return started


REFUND_URL = "https://api.paystack.co/refund"


class RefundError(Exception):
    """Paystack could not be reached or did not accept the refund. The message holds no key and no email."""


async def create_refund(*, reference: str, client: httpx.AsyncClient | None = None) -> None:
    """Asks Paystack to give a whole payment back (the owner fee of a rejected claim).

    From Paystack's refunds page (https://paystack.com/docs/payments/refunds/): POST
    https://api.paystack.co/refund with `Authorization: Bearer <secret key>` and a JSON body whose
    `transaction` is the transaction reference; with no `amount` the refund is for the whole payment. Paystack
    answers that the refund was queued (`status` true). Not tested against the real service: the tests use a
    mock transport. Check it once in the Paystack test dashboard.

    Raises PaymentsNotSetUpError and LiveKeyRefusedError like every call here, and RefundError. `async def`
    because it awaits httpx.
    """
    key = secret_key()
    headers = {"Authorization": f"Bearer {key}"}
    sending_client = client or httpx.AsyncClient(timeout=TIMEOUT_SECONDS)
    try:
        response = await sending_client.post(REFUND_URL, json={"transaction": reference}, headers=headers)
    except httpx.HTTPError as error:
        raise RefundError(f"Could not reach Paystack ({type(error).__name__}).") from error
    finally:
        if client is None:
            await sending_client.aclose()
    if not response.is_success:
        raise RefundError(f"Paystack answered with HTTP {response.status_code}.")
    try:
        accepted = response.json().get("status") is True
    except (ValueError, AttributeError):
        accepted = False
    if not accepted:
        raise RefundError("Paystack did not accept the refund.")


def signature_is_valid(raw_body: bytes, signature: str | None) -> bool:
    """True when `signature` is the HMAC SHA-512 of `raw_body` made with the secret key (FR-44).

    Compared in constant time. A missing or malformed signature, or a missing or live key, is not valid.
    Plain `def`: it only does arithmetic on values in memory.
    """
    try:
        key = secret_key()
    except (PaymentsNotSetUpError, LiveKeyRefusedError):
        return False
    if not signature:
        return False
    expected = hmac.new(key.encode(), raw_body, hashlib.sha512).hexdigest()
    try:
        return hmac.compare_digest(expected.encode(), signature.strip().lower().encode("ascii"))
    except UnicodeEncodeError:
        return False

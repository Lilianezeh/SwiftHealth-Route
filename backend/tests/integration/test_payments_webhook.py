"""POST /payments/webhook and GET /payments/verify/{reference}. Requirements: FR-44, FR-46, NFR-06, NFR-07.
Contract: specs/backend/api-spec.md, section 8 ("Phase 12 rules"). Decisions I4 to I9 in
specs/2026-10-20-providers-payments/requirements.md. Events are signed here with a fictional test key, the way
Paystack documents it (HMAC SHA-512 of the raw body). Nothing calls Paystack. Every address is fictional.
"""

import asyncio
import hashlib
import hmac
import json
import logging
from collections.abc import Iterator
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment
from app.core.config import settings
from app.main import app
from app.models import AuditEntry, Listing, User
from app.models.base import Role
from app.services import payment_service
from tests.conftest import TEST_DATABASE_URL
from tests.factories import add_listing, add_owner_link
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 10, 6, 9, 0, tzinfo=timezone.utc)
TEST_KEY = "sk_test_not_a_real_key"
CUSTOMER_EMAIL = "customer@example.test"
KOBO = 500000  # the default price, 5000.00 naira


@pytest.fixture(autouse=True)
def test_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "paystack_secret_key", TEST_KEY)


@pytest.fixture
def clock() -> Iterator[None]:
    app.dependency_overrides[get_current_moment] = lambda: NOW
    yield
    app.dependency_overrides.pop(get_current_moment, None)


def sign(body: bytes, key: str = TEST_KEY) -> str:
    return hmac.new(key.encode(), body, hashlib.sha512).hexdigest()


def charge_success(listing: Listing, **changes: object) -> dict:
    data: dict = {
        "reference": f"SH-{listing.id}-1730000000",
        "status": "success",
        "amount": KOBO,
        "currency": "NGN",
        "metadata": {"listing_id": listing.id},
        "customer": {"email": CUSTOMER_EMAIL},
    }
    data.update(changes)
    return {"event": "charge.success", "data": data}


async def post_event(client: AsyncClient, event: object, signature: str | None = "valid") -> object:
    body = json.dumps(event).encode()
    headers = {"content-type": "application/json"}
    if signature == "valid":
        headers["x-paystack-signature"] = sign(body)
    elif signature is not None:
        headers["x-paystack-signature"] = signature
    return await client.post("/payments/webhook", content=body, headers=headers)


async def featured_listing(session: AsyncSession, **kwargs: object) -> Listing:
    listing = await add_listing(session, "Provider Clinic", **kwargs)
    await session.commit()
    return listing


async def payments(session: AsyncSession) -> list[AuditEntry]:
    entries = (await session.exec(select(AuditEntry).order_by(AuditEntry.id))).all()
    return [entry for entry in entries if entry.action == "payment"]


# --- a good event ---


async def test_a_signed_charge_success_features_the_listing_for_30_days_and_writes_the_audit_entry(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    listing = await featured_listing(session)

    response = await post_event(client, charge_success(listing))

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    await session.refresh(listing)
    assert listing.featured_until == NOW + timedelta(days=30)
    [entry] = await payments(session)
    assert entry.user_id is None
    assert entry.listing_id == listing.id
    assert (entry.field_changed, entry.old_value) == ("featured_until", None)
    assert entry.new_value == (NOW + timedelta(days=30)).isoformat()
    assert (
        entry.reference == f"SH-{listing.id}-1730000000"
    )  # FR-46: the Paystack reference is in the audit log
    assert CUSTOMER_EMAIL not in json.dumps(entry.model_dump(), default=str)


async def test_a_running_period_is_extended_not_restarted(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    listing = await featured_listing(session, featured_until=NOW + timedelta(days=10))

    await post_event(client, charge_success(listing))

    await session.refresh(listing)
    assert listing.featured_until == NOW + timedelta(days=40)
    [entry] = await payments(session)
    assert entry.old_value == (NOW + timedelta(days=10)).isoformat()


async def test_an_ended_period_starts_again_from_now(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    listing = await featured_listing(session, featured_until=NOW - timedelta(days=5))

    await post_event(client, charge_success(listing))

    await session.refresh(listing)
    assert listing.featured_until == NOW + timedelta(days=30)


async def test_two_different_payments_add_up(client: AsyncClient, session: AsyncSession, clock: None) -> None:
    listing = await featured_listing(session)

    await post_event(client, charge_success(listing, reference=f"SH-{listing.id}-1"))
    await post_event(client, charge_success(listing, reference=f"SH-{listing.id}-2"))

    await session.refresh(listing)
    assert listing.featured_until == NOW + timedelta(days=60)
    assert len(await payments(session)) == 2


async def test_an_amount_above_the_price_is_accepted(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    listing = await featured_listing(session)

    await post_event(client, charge_success(listing, amount=KOBO + 100))

    await session.refresh(listing)
    assert listing.featured_until == NOW + timedelta(days=30)


# --- the same event again (FR-46) ---


async def test_the_same_event_twice_applies_once_and_both_answers_are_200(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    listing = await featured_listing(session)
    event = charge_success(listing)

    first = await post_event(client, event)
    second = await post_event(client, event)

    assert (first.status_code, second.status_code) == (200, 200)
    await session.refresh(listing)
    assert listing.featured_until == NOW + timedelta(days=30)
    assert len(await payments(session)) == 1


async def test_two_webhooks_for_the_same_reference_at_the_same_moment_apply_once(
    session: AsyncSession,
) -> None:
    """Two requests that both see "not applied yet" must not both apply: the lock makes the second wait."""
    listing = await featured_listing(session)
    event = payment_service.ChargeEvent(
        reference=f"SH-{listing.id}-1730000000", listing_id=listing.id, amount_kobo=KOBO
    )
    engine = create_async_engine(TEST_DATABASE_URL)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def apply() -> bool:
        async with factory() as own_session:
            return await payment_service.apply_charge_success(own_session, event, NOW)

    results = await asyncio.gather(apply(), apply(), apply())
    await engine.dispose()

    assert sorted(results) == [False, False, True]
    await session.refresh(listing)
    assert listing.featured_until == NOW + timedelta(days=30)
    assert len(await payments(session)) == 1


# --- the signature (FR-44) ---


@pytest.mark.parametrize("signature", [None, "", "abc", "0" * 128])
async def test_a_missing_or_wrong_signature_is_401_and_nothing_changes(
    client: AsyncClient, session: AsyncSession, clock: None, signature: str | None
) -> None:
    listing = await featured_listing(session)

    response = await post_event(client, charge_success(listing), signature=signature)

    assert response.status_code == 401
    await session.refresh(listing)
    assert listing.featured_until is None
    assert await payments(session) == []


async def test_a_signature_made_with_another_key_is_401(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    listing = await featured_listing(session)
    body = json.dumps(charge_success(listing)).encode()

    response = await client.post(
        "/payments/webhook", content=body, headers={"x-paystack-signature": sign(body, "sk_test_another")}
    )

    assert response.status_code == 401
    await session.refresh(listing)
    assert listing.featured_until is None


async def test_a_body_changed_after_signing_is_401(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    listing = await featured_listing(session)
    signed = json.dumps(charge_success(listing)).encode()
    changed = json.dumps(charge_success(listing, amount=KOBO * 10)).encode()

    response = await client.post(
        "/payments/webhook", content=changed, headers={"x-paystack-signature": sign(signed)}
    )

    assert response.status_code == 401
    assert await payments(session) == []


@pytest.mark.parametrize("key", ["", "sk_live_not_a_real_key"])
async def test_with_no_key_or_a_live_key_nothing_is_accepted(
    client: AsyncClient, session: AsyncSession, clock: None, monkeypatch: pytest.MonkeyPatch, key: str
) -> None:
    monkeypatch.setattr(settings, "paystack_secret_key", key)
    listing = await featured_listing(session)
    body = json.dumps(charge_success(listing)).encode()

    response = await client.post(
        "/payments/webhook", content=body, headers={"x-paystack-signature": sign(body, key)}
    )

    assert response.status_code == 401
    assert await payments(session) == []


async def test_a_signed_body_that_is_not_json_is_400(client: AsyncClient, clock: None) -> None:
    body = b"this is not json"

    response = await client.post(
        "/payments/webhook", content=body, headers={"x-paystack-signature": sign(body)}
    )

    assert response.status_code == 400


async def test_a_signed_json_that_is_not_an_object_is_400(client: AsyncClient, clock: None) -> None:
    assert (await post_event(client, [1, 2, 3])).status_code == 400


# --- events we ignore (200, nothing changes) ---


@pytest.mark.parametrize(
    "change",
    [
        {"event": "charge.failed"},
        {"event": "transfer.success"},
        {"event": None},
        {"data": {"status": "failed"}},
        {"data": {"status": "abandoned"}},
        {"data": {"reference": "ABC"}},
        {"data": {"reference": "SH-99999-1730000000"}},  # another listing than the metadata says
        {"data": {"reference": "SH-x-1730000000"}},
        {"data": {"metadata": {}}},
        {"data": {"metadata": {"listing_id": "not a number"}}},
        {"data": {"metadata": None}},
        {"data": {"amount": KOBO - 1}},
        {"data": {"amount": 0}},
        {"data": {"amount": "500000"}},
        {"data": {"amount": 500000.0}},
        {"data": {"amount": None}},
        {"data": None},
    ],
)
async def test_an_event_that_is_not_a_good_charge_is_ignored_with_200(
    client: AsyncClient, session: AsyncSession, clock: None, change: dict
) -> None:
    listing = await featured_listing(session)
    event = charge_success(listing)
    for key, value in change.items():
        if key == "data" and isinstance(value, dict):
            event["data"].update(value)
        else:
            event[key] = value

    response = await post_event(client, event)

    assert response.status_code == 200
    await session.refresh(listing)
    assert listing.featured_until is None
    assert await payments(session) == []


async def test_an_event_for_a_listing_that_does_not_exist_is_ignored(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    event = {
        "event": "charge.success",
        "data": {
            "reference": "SH-424242-1730000000",
            "status": "success",
            "amount": KOBO,
            "metadata": {"listing_id": 424242},
        },
    }

    assert (await post_event(client, event)).status_code == 200
    assert await payments(session) == []


async def test_nothing_of_the_body_or_the_customer_is_logged(
    client: AsyncClient, session: AsyncSession, clock: None, caplog: pytest.LogCaptureFixture
) -> None:
    listing = await featured_listing(session)
    caplog.set_level(logging.DEBUG)

    await post_event(client, charge_success(listing, status="failed"))  # ignored
    await post_event(client, charge_success(listing))  # applied
    await post_event(client, charge_success(listing), signature="0" * 128)  # refused

    logged = caplog.text
    assert CUSTOMER_EMAIL not in logged
    assert TEST_KEY not in logged
    assert "customer" not in logged


# --- GET /payments/verify/{reference} ---


async def verify(client: AsyncClient, user: User | None, reference: str):
    return await client.get(f"/payments/verify/{reference}", headers=bearer_for(user) if user else {})


async def own_listing(session: AsyncSession, provider: User, name: str = "Provider Clinic") -> Listing:
    listing = await add_listing(session, name)
    listing.owner_id = provider.id
    session.add(listing)
    await add_owner_link(session, listing, provider)  # since phase 6a the approved link gives the access
    await session.commit()
    return listing


async def test_verify_says_pending_until_the_webhook_has_been_applied_and_then_success(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    provider = demo_users[Role.provider]
    listing = await own_listing(session, provider)
    reference = f"SH-{listing.id}-1730000000"

    before = await verify(client, provider, reference)
    await post_event(client, charge_success(listing))
    after = await verify(client, provider, reference)

    assert before.json() == {"status": "pending", "featured_until": None}
    assert after.status_code == 200
    assert after.json()["status"] == "success"
    assert after.json()["featured_until"].startswith("2026-11-05T09:00:00")


async def test_verify_does_not_apply_anything_itself(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    provider = demo_users[Role.provider]
    listing = await own_listing(session, provider)

    await verify(client, provider, f"SH-{listing.id}-1730000000")

    await session.refresh(listing)
    assert listing.featured_until is None
    assert await payments(session) == []


@pytest.mark.parametrize("reference", ["ABC", "SH-1-", "SH-x-1730000000", "SH-99999-1730000000"])
async def test_verify_is_404_for_a_reference_that_is_not_of_the_callers_listing(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None, reference: str
) -> None:
    await own_listing(session, demo_users[Role.provider])

    assert (await verify(client, demo_users[Role.provider], reference)).status_code == 404


async def test_a_provider_cannot_verify_another_providers_payment(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    other = User(
        name="Other Provider",
        email="other@demo.example.com",
        phone="+2340000000088",
        password_hash="x",
        role=Role.provider,
        email_verified_at=NOW,  # a made-by-hand user must be confirmed to log in (FR-48)
        phone_verified_at=NOW,
    )
    session.add(other)
    await session.commit()
    mine = await own_listing(session, demo_users[Role.provider], "Mine Clinic")
    theirs = await own_listing(session, other, "Theirs Clinic")
    await post_event(client, charge_success(theirs))

    assert (await verify(client, demo_users[Role.provider], f"SH-{theirs.id}-1730000000")).status_code == 404
    assert (await verify(client, other, f"SH-{theirs.id}-1730000000")).json()["status"] == "success"
    assert (await verify(client, demo_users[Role.provider], f"SH-{mine.id}-1730000000")).json()[
        "status"
    ] == "pending"


@pytest.mark.parametrize("role", [Role.verifier, Role.editor, Role.admin])
async def test_only_a_provider_can_verify(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None, role: Role
) -> None:
    listing = await own_listing(session, demo_users[Role.provider])

    assert (await verify(client, demo_users[role], f"SH-{listing.id}-1")).status_code == 403


async def test_verify_without_a_token_is_401_and_without_a_listing_404(
    client: AsyncClient, demo_users: dict[Role, User], clock: None
) -> None:
    assert (await verify(client, None, "SH-1-1")).status_code == 401
    assert (await verify(client, demo_users[Role.provider], "SH-1-1")).status_code == 404

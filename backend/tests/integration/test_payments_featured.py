"""POST /payments/featured. Requirements: FR-44, NFR-06.
Contract: specs/backend/api-spec.md, section 8 ("Phase 12 rules").
Decisions I3, I5 and I10 in specs/2026-10-20-providers-payments/requirements.md.
Paystack is replaced by a recorder: nothing here calls Paystack. Every key, address and number is fictional.
"""

from collections.abc import Iterator
from datetime import datetime, timezone
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment
from app.core.config import settings
from app.integrations import paystack
from app.main import app
from app.models import AuditEntry, Listing, User
from app.models.base import ListingStatus, Role
from tests.factories import add_listing, add_owner_link
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 10, 6, 9, 0, tzinfo=timezone.utc)
CHECKOUT = "https://checkout.paystack.com/fictional"


@pytest.fixture
def clock() -> Iterator[None]:
    app.dependency_overrides[get_current_moment] = lambda: NOW
    yield
    app.dependency_overrides.pop(get_current_moment, None)


@pytest.fixture
def started(monkeypatch: pytest.MonkeyPatch) -> list[dict]:
    """Replaces the call to Paystack by a recorder that answers with a checkout address."""
    calls: list[dict] = []

    async def record(**arguments: object) -> paystack.StartedPayment:
        calls.append(arguments)
        return paystack.StartedPayment(CHECKOUT, str(arguments["reference"]))

    monkeypatch.setattr(paystack, "initialize_transaction", record)
    return calls


async def provider_listing(
    session: AsyncSession, provider: User, status: ListingStatus = ListingStatus.published
) -> Listing:
    listing = await add_listing(session, "Provider Clinic", status=status)
    listing.owner_id = provider.id
    session.add(listing)
    await add_owner_link(session, listing, provider)  # since phase 6a the approved link gives the access
    await session.commit()
    return listing


async def start(client: AsyncClient, user: User | None, body: object = None):
    headers = bearer_for(user) if user else {}
    return await client.post(
        "/payments/featured", json={"plan": "monthly"} if body is None else body, headers=headers
    )


async def test_a_provider_starts_a_payment_and_gets_the_checkout_address(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None, started: list[dict]
) -> None:
    provider = demo_users[Role.provider]
    listing = await provider_listing(session, provider)

    response = await start(client, provider)

    assert response.status_code == 200
    reference = f"SH-{listing.id}-{int(NOW.timestamp())}"
    assert response.json() == {
        "authorization_url": CHECKOUT,
        "reference": reference,
        "amount_naira": "5000.00",
    }
    [call] = started
    assert call["email"] == provider.email
    assert call["reference"] == reference
    assert call["metadata"] == {"listing_id": listing.id}
    assert call["callback_url"] == "http://localhost:3000/provider/payment-complete"


async def test_starting_a_payment_changes_nothing_in_the_database(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None, started: list[dict]
) -> None:
    provider = demo_users[Role.provider]
    listing = await provider_listing(session, provider)

    await start(client, provider)

    await session.refresh(listing)
    assert listing.featured_until is None  # only a verified webhook can feature a listing (FR-44)
    assert (await session.exec(select(AuditEntry))).all() == []


@pytest.mark.parametrize(
    ("price", "kobo"),
    [("5000.00", 500000), ("1499.99", 149999), ("1500.5", 150050), ("0.10", 10)],
)
async def test_the_amount_is_the_price_as_a_decimal_in_kobo_and_a_string_in_naira(
    client: AsyncClient,
    session: AsyncSession,
    demo_users: dict[Role, User],
    clock: None,
    started: list[dict],
    monkeypatch: pytest.MonkeyPatch,
    price: str,
    kobo: int,
) -> None:
    monkeypatch.setattr(settings, "featured_price_naira", Decimal(price))
    provider = demo_users[Role.provider]
    await provider_listing(session, provider)

    response = await start(client, provider)

    assert started[0]["amount_kobo"] == kobo
    assert isinstance(started[0]["amount_kobo"], int)
    assert response.json()["amount_naira"] == f"{Decimal(price):.2f}"


async def test_the_return_address_is_the_web_app_address_when_one_is_set(
    client: AsyncClient,
    session: AsyncSession,
    demo_users: dict[Role, User],
    clock: None,
    started: list[dict],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "web_app_url", "https://example.test/")
    provider = demo_users[Role.provider]
    await provider_listing(session, provider)

    await start(client, provider)

    assert started[0]["callback_url"] == "https://example.test/provider/payment-complete"


async def test_with_no_web_app_address_the_first_cors_origin_is_used(
    client: AsyncClient,
    session: AsyncSession,
    demo_users: dict[Role, User],
    clock: None,
    started: list[dict],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "web_app_url", "")
    monkeypatch.setattr(settings, "cors_origins", "https://first.example.test, https://second.example.test")
    provider = demo_users[Role.provider]
    await provider_listing(session, provider)

    await start(client, provider)

    assert started[0]["callback_url"] == "https://first.example.test/provider/payment-complete"


@pytest.mark.parametrize("role", [Role.verifier, Role.editor, Role.admin])
async def test_only_a_provider_can_start_a_payment(
    client: AsyncClient,
    session: AsyncSession,
    demo_users: dict[Role, User],
    clock: None,
    started: list[dict],
    role: Role,
) -> None:
    await provider_listing(session, demo_users[Role.provider])

    assert (await start(client, demo_users[role])).status_code == 403
    assert started == []


async def test_without_a_token_it_is_401(client: AsyncClient, clock: None, started: list[dict]) -> None:
    assert (await start(client, None)).status_code == 401
    assert started == []


@pytest.mark.parametrize("body", [{}, {"plan": "yearly"}, {"plan": ""}, {"plan": "monthly", "amount": 1}])
async def test_only_the_monthly_plan_with_nothing_else_is_accepted(
    client: AsyncClient,
    session: AsyncSession,
    demo_users: dict[Role, User],
    clock: None,
    started: list[dict],
    body: dict,
) -> None:
    provider = demo_users[Role.provider]
    await provider_listing(session, provider)

    response = await start(client, provider, body)

    assert response.status_code == 422  # the provider cannot choose the amount
    assert started == []


@pytest.mark.parametrize(
    "status",
    [ListingStatus.draft, ListingStatus.pending_review, ListingStatus.hidden, ListingStatus.recheck_due],
)
async def test_a_listing_that_is_not_published_cannot_be_featured(
    client: AsyncClient,
    session: AsyncSession,
    demo_users: dict[Role, User],
    clock: None,
    started: list[dict],
    status: ListingStatus,
) -> None:
    provider = demo_users[Role.provider]
    await provider_listing(session, provider, status)

    response = await start(client, provider)

    assert response.status_code == 400
    assert started == []


async def test_a_provider_with_no_linked_listing_gets_404(
    client: AsyncClient, demo_users: dict[Role, User], clock: None, started: list[dict]
) -> None:
    assert (await start(client, demo_users[Role.provider])).status_code == 404
    assert started == []


@pytest.mark.parametrize(
    ("error", "status", "message"),
    [
        (paystack.PaymentsNotSetUpError(), 503, "Payments are not set up yet."),
        (paystack.LiveKeyRefusedError(), 503, "Live payments are switched off."),
        (
            paystack.PaymentStartError("Paystack answered with HTTP 500."),
            502,
            "Could not start the payment. Try again.",
        ),
    ],
)
async def test_a_payment_that_cannot_start_is_a_503_or_502_with_a_plain_sentence(
    client: AsyncClient,
    session: AsyncSession,
    demo_users: dict[Role, User],
    clock: None,
    monkeypatch: pytest.MonkeyPatch,
    error: Exception,
    status: int,
    message: str,
) -> None:
    async def fail(**_: object) -> paystack.StartedPayment:
        raise error

    monkeypatch.setattr(paystack, "initialize_transaction", fail)
    provider = demo_users[Role.provider]
    await provider_listing(session, provider)

    response = await start(client, provider)

    assert response.status_code == status
    assert response.json()["detail"] == message


async def test_a_live_key_in_the_settings_is_refused_for_real(
    client: AsyncClient,
    session: AsyncSession,
    demo_users: dict[Role, User],
    clock: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """No recorder here: the real integration runs and must stop before any network call."""
    monkeypatch.setattr(settings, "paystack_secret_key", "sk_live_not_a_real_key")
    provider = demo_users[Role.provider]
    await provider_listing(session, provider)

    response = await start(client, provider)

    assert response.status_code == 503
    assert response.json()["detail"] == "Live payments are switched off."
    assert "sk_live" not in response.text

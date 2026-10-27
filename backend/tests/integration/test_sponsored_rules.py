"""The four rules of "Sponsored", checked in one place. Requirements: FR-19, FR-44, FR-45, FR-46, FR-08.
Contract: specs/backend/api-spec.md, section 8, "Sponsored rules" (the owner's check of 2026-10-27).

1. A sponsored result is always labelled (`sponsored: true`), and only the one in the slot is.
2. Paying never changes verification.
3. Nothing paid in SwiftRescue or above 112.
4. Only published, verified listings can be featured.
The more detailed tests of the slot and of the payments are in `test_search_sponsored.py`,
`test_payments_featured.py` and `test_payments_webhook.py`. Every name and number here is fictional.
"""

from collections.abc import Iterator
from datetime import datetime, time, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment
from app.integrations import paystack
from app.main import app
from app.models import AuditEntry, Listing, User
from app.models.base import ListingStatus, Role
from app.repositories import audit_repository, category_repository
from app.services import payment_service
from tests.factories import add_listing, add_owner_link, every_day
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 10, 6, 9, 0, tzinfo=timezone.utc)  # Tuesday 10:00 in Lagos
FEATURED = NOW + timedelta(days=10)
VERIFIED = NOW - timedelta(days=2)
NEXT_CHECK = NOW + timedelta(days=30)
HERE = (6.4500, 7.5080)
ONLY_PUBLISHED = "Only a published listing can be featured."
ONLY_VERIFIED = "Only a verified listing can be featured."


@pytest.fixture
def clock() -> Iterator[None]:
    app.dependency_overrides[get_current_moment] = lambda: NOW
    yield
    app.dependency_overrides.pop(get_current_moment, None)


@pytest.fixture
def started(monkeypatch: pytest.MonkeyPatch) -> list[dict]:
    """Replaces the call to Paystack by a recorder, so nothing real is ever called."""
    calls: list[dict] = []

    async def record(**arguments: object) -> paystack.StartedPayment:
        calls.append(arguments)
        return paystack.StartedPayment("https://checkout.paystack.com/fictional", str(arguments["reference"]))

    monkeypatch.setattr(paystack, "initialize_transaction", record)
    return calls


async def place(session: AsyncSession, name: str, km_north: float = 1, **kwargs: object) -> Listing:
    """A verified pharmacy `km_north` kilometres north of HERE, open all day, checked 2 days ago."""
    kwargs.setdefault("last_verified_at", VERIFIED)
    kwargs.setdefault("next_check_due", NEXT_CHECK)
    kwargs.setdefault("opening_hours", every_day(time(0, 0), time(23, 59)))
    return await add_listing(
        session, name, latitude=HERE[0] + km_north * 0.009, longitude=HERE[1], **kwargs
    )


async def search(client: AsyncClient, **params: object) -> list[dict]:
    response = await client.get("/search", params={"lat": HERE[0], "lng": HERE[1], **params})
    assert response.status_code == 200, response.text
    return response.json()["items"]


async def start_payment(client: AsyncClient, provider: User):
    return await client.post("/payments/featured", json={"plan": "monthly"}, headers=bearer_for(provider))


async def verification_shown(client: AsyncClient) -> dict[str, tuple[str | None, bool]]:
    """What a visitor sees of verification in each search result: the date and the "Verification due" flag."""
    items = await search(client)
    return {item["name"]: (item["last_verified_at"], item["verification_due"]) for item in items}


async def payment_entries(session: AsyncSession) -> list[AuditEntry]:
    query = select(AuditEntry).where(AuditEntry.action == audit_repository.PAYMENT_ACTION)
    return list((await session.exec(query)).all())


async def providers_listing(session: AsyncSession, provider: User, **kwargs: object) -> Listing:
    listing = await place(session, "Provider Clinic", **kwargs)
    await add_owner_link(session, listing, provider)
    await session.commit()
    return listing


async def charge(session: AsyncSession, listing: Listing, reference: str = "SH-1-1") -> bool:
    event = payment_service.ChargeEvent(
        reference=reference, listing_id=listing.id, amount_kobo=payment_service.amount_in_kobo()
    )
    return await payment_service.apply_charge_success(session, event, NOW)


# ---------- 1. always labelled ----------


async def test_only_the_one_listing_in_the_slot_is_sponsored_and_it_is_first(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    await place(session, "Near Pharmacy", 0.5)
    await place(session, "First Featured", 2, featured_until=FEATURED)
    await place(session, "Second Featured", 3, featured_until=FEATURED)
    await session.commit()

    items = await search(client)

    assert [(item["name"], item["sponsored"]) for item in items] == [
        ("First Featured", True), ("Near Pharmacy", False), ("Second Featured", False),
    ]


async def test_no_other_answer_of_the_api_ever_says_sponsored_true(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    await category_repository.create(
        session, name="Ambulance", slug="ambulance", is_emergency=True, recheck_days=14
    )
    await category_repository.create(
        session, name="Blood bank", slug="blood-bank", is_emergency=True, recheck_days=14
    )
    featured = await place(session, "Featured Pharmacy", 1, featured_until=FEATURED)
    await place(session, "Featured Ambulance", 2, category_slug="ambulance", featured_until=FEATURED)
    await place(session, "Featured Bank", 3, category_slug="blood-bank", featured_until=FEATURED)
    await session.commit()
    assert [item["sponsored"] for item in await search(client)][0] is True  # the slot works

    page = (await client.get(f"/listings/{featured.slug}")).json()
    emergency = (await client.get("/emergency")).json()
    banks = (await client.get("/blood/banks")).json()
    staff = (await client.get("/listings", headers=bearer_for(demo_users[Role.editor]))).json()

    assert page["sponsored"] is False
    assert [c["sponsored"] for g in emergency["groups"] for c in g["contacts"]] != []
    assert not any(c["sponsored"] for g in emergency["groups"] for c in g["contacts"])
    assert not any(item["sponsored"] for item in banks["items"])
    assert not any(item["sponsored"] for item in staff["items"])


# ---------- 2. paying never changes verification ----------


async def test_a_confirmed_payment_changes_only_featured_until_and_its_audit_entry(
    session: AsyncSession,
) -> None:
    listing = await place(session, "Paid Clinic", status=ListingStatus.published)
    await session.commit()
    before = (listing.status, listing.last_verified_at, listing.next_check_due, listing.updated_at)

    assert await charge(session, listing) is True

    await session.refresh(listing)
    assert (listing.status, listing.last_verified_at, listing.next_check_due) == before[:3]
    assert listing.featured_until == NOW + payment_service.FEATURED_PERIOD
    [entry] = await payment_entries(session)
    assert entry.field_changed == "featured_until"
    every_entry = (await session.exec(select(AuditEntry))).all()
    assert [row.field_changed for row in every_entry] == ["featured_until"]  # nothing else was written


async def test_a_paid_listing_shows_the_same_verified_date_and_the_same_verification_due(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    overdue = await place(session, "Overdue Clinic", 1, next_check_due=NOW - timedelta(days=3))
    fine = await place(session, "Fine Clinic", 2)
    await session.commit()
    before = await verification_shown(client)

    await charge(session, overdue, "SH-1-1")
    await charge(session, fine, "SH-2-1")

    after = await verification_shown(client)
    assert after == before
    assert after["Overdue Clinic"][1] is True  # paying did not make an overdue listing current


async def test_paying_does_not_move_a_listing_in_the_normal_order(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    await place(session, "A Pharmacy", 1)
    second = await place(session, "B Pharmacy", 2)
    await place(session, "C Pharmacy", 3)
    await session.commit()
    plain = [item["name"] for item in await search(client)]

    # the middle one pays; with the slot it comes first and nothing else changes in the order of the rest
    await charge(session, second)
    paid = [item["name"] for item in await search(client)]

    assert plain == ["A Pharmacy", "B Pharmacy", "C Pharmacy"]
    assert paid == ["B Pharmacy", "A Pharmacy", "C Pharmacy"]
    assert [name for name in paid if name != "B Pharmacy"] == [name for name in plain if name != "B Pharmacy"]


# ---------- 3. nothing paid in SwiftRescue or above 112 ----------


async def test_the_emergency_answer_is_the_same_with_or_without_a_paid_listing_and_112_is_first(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    await category_repository.create(
        session, name="Ambulance", slug="ambulance", is_emergency=True, recheck_days=14
    )
    await place(session, "Ambulance A", 1, category_slug="ambulance")
    paying = await place(session, "Ambulance B", 2, category_slug="ambulance")
    await place(session, "Ambulance C", 3, category_slug="ambulance")
    await session.commit()
    plain = (await client.get("/emergency", params={"lat": HERE[0], "lng": HERE[1]})).json()

    await charge(session, paying)
    paid = (await client.get("/emergency", params={"lat": HERE[0], "lng": HERE[1]})).json()

    assert paid == plain
    assert paid["national_line"]["number"] == "112"
    group = next(g for g in paid["groups"] if g["category"]["slug"] == "ambulance")
    assert [c["name"] for c in group["contacts"]] == ["Ambulance A", "Ambulance B", "Ambulance C"]
    assert not any(c["sponsored"] for c in group["contacts"])


async def test_a_paid_emergency_listing_is_never_the_sponsored_one_in_search(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    await category_repository.create(
        session, name="Ambulance", slug="ambulance", is_emergency=True, recheck_days=14
    )
    await place(session, "Paid Ambulance", 1, category_slug="ambulance", featured_until=FEATURED)
    await place(session, "Plain Pharmacy", 2)
    await session.commit()

    assert not any(item["sponsored"] for item in await search(client))


# ---------- 4. only published, verified listings can be featured ----------


async def test_a_published_verified_listing_can_start_a_payment(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None, started: list[dict]
) -> None:
    await providers_listing(session, demo_users[Role.provider])
    assert (await start_payment(client, demo_users[Role.provider])).status_code == 200
    assert len(started) == 1


async def test_a_listing_that_was_never_verified_cannot_start_a_payment(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None, started: list[dict]
) -> None:
    await providers_listing(session, demo_users[Role.provider], last_verified_at=None)

    response = await start_payment(client, demo_users[Role.provider])

    assert response.status_code == 400
    assert response.json()["detail"] == ONLY_VERIFIED
    assert started == []


async def test_an_overdue_listing_cannot_start_a_payment(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None, started: list[dict]
) -> None:
    await providers_listing(session, demo_users[Role.provider], next_check_due=NOW - timedelta(days=1))

    response = await start_payment(client, demo_users[Role.provider])

    assert response.status_code == 400
    assert response.json()["detail"] == ONLY_VERIFIED
    assert started == []


@pytest.mark.parametrize(
    "status",
    [ListingStatus.draft, ListingStatus.pending_review, ListingStatus.hidden, ListingStatus.recheck_due],
)
async def test_a_listing_that_is_not_published_cannot_start_a_payment(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None,
    started: list[dict], status: ListingStatus,
) -> None:
    await providers_listing(session, demo_users[Role.provider], status=status)

    response = await start_payment(client, demo_users[Role.provider])

    assert response.status_code == 400
    assert response.json()["detail"] == ONLY_PUBLISHED
    assert started == []


async def test_the_slot_skips_a_featured_listing_that_was_never_verified(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    await place(session, "Unverified Featured", 1, featured_until=FEATURED, last_verified_at=None)
    await place(session, "Verified Featured", 2, featured_until=FEATURED)
    await session.commit()

    items = await search(client)

    assert [(item["name"], item["sponsored"]) for item in items] == [
        ("Verified Featured", True), ("Unverified Featured", False),
    ]


async def test_the_slot_skips_an_overdue_featured_listing_and_stays_empty_when_none_is_left(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    await place(
        session, "Overdue Featured", 1, featured_until=FEATURED, next_check_due=NOW - timedelta(days=1)
    )
    await place(session, "Plain Pharmacy", 2)
    await session.commit()

    items = await search(client)

    assert not any(item["sponsored"] for item in items)
    assert [item["name"] for item in items] == ["Overdue Featured", "Plain Pharmacy"]  # the normal order


async def test_a_payment_for_a_listing_that_is_no_longer_eligible_is_recorded_but_shows_nothing(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    listing = await place(session, "Hidden After Paying", 1, status=ListingStatus.hidden)
    await place(session, "Plain Pharmacy", 2)
    await session.commit()

    assert await charge(session, listing) is True

    await session.refresh(listing)
    assert listing.featured_until == NOW + payment_service.FEATURED_PERIOD
    assert len(await payment_entries(session)) == 1
    items = await search(client)
    assert [item["name"] for item in items] == ["Plain Pharmacy"]  # hidden: not shown, not sponsored
    # eligible again: it takes the slot with the period it paid for
    listing.status = ListingStatus.published
    session.add(listing)
    await session.commit()
    first = (await search(client))[0]
    assert (first["name"], first["sponsored"]) == ("Hidden After Paying", True)

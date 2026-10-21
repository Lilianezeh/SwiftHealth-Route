"""GET and PATCH /provider/listing. Requirements: FR-43, FR-38, NFR-06, NFR-07.
Contract: specs/backend/api-spec.md, section 7 ("Phase 12 rules"). Decisions I1 and I2 in
specs/2026-10-20-providers-payments/requirements.md. The clock is replaced with a fixed moment.
"""

from collections.abc import Iterator
from datetime import datetime, time, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment
from app.main import app
from app.models import AuditEntry, Listing, OpeningHours, PhoneNumber, Service, User
from app.models.base import ListingStatus, Role
from tests.factories import add_listing
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 10, 6, 9, 0, tzinfo=timezone.utc)
NEXT_CHECK = NOW + timedelta(days=30)


@pytest.fixture
def clock() -> Iterator[None]:
    app.dependency_overrides[get_current_moment] = lambda: NOW
    yield
    app.dependency_overrides.pop(get_current_moment, None)


async def own_listing(
    session: AsyncSession, provider: User, name: str = "Provider Clinic", **kwargs: object
) -> Listing:
    listing = await add_listing(
        session,
        name,
        category_slug="clinic",
        next_check_due=kwargs.pop("next_check_due", NEXT_CHECK),
        last_verified_at=NOW - timedelta(days=15),
        opening_hours=[OpeningHours(listing_id=0, day_of_week=0, opens_at=time(8), closes_at=time(17))],
        **kwargs,
    )
    listing.owner_id = provider.id
    session.add(listing)
    await session.commit()
    return listing


async def get_own(client: AsyncClient, user: User | None):
    return await client.get("/provider/listing", headers=bearer_for(user) if user else {})


async def patch_own(client: AsyncClient, user: User | None, body: object):
    return await client.patch("/provider/listing", json=body, headers=bearer_for(user) if user else {})


async def audit(session: AsyncSession) -> list[AuditEntry]:
    return list((await session.exec(select(AuditEntry).order_by(AuditEntry.id))).all())


# --- reading ---


async def test_a_provider_reads_their_own_listing_with_the_staff_fields_and_the_price(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    provider = demo_users[Role.provider]
    listing = await own_listing(session, provider, featured_until=NOW + timedelta(days=3))

    response = await get_own(client, provider)

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == listing.id
    assert body["status"] == "published"
    assert body["owner_id"] == provider.id
    assert body["featured_until"].startswith("2026-10-09T09:00:00")
    assert body["next_check_due"].startswith("2026-11-05")
    assert body["featured_price_naira"] == "5000.00"  # a string with 2 decimals, never a float
    assert len(body["opening_hours"]) == 7


async def test_a_provider_reads_only_their_own_listing(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    provider = demo_users[Role.provider]
    other = User(
        name="Other Provider",
        email="other@demo.example.com",
        phone="+2340000000088",
        password_hash="x",
        role=Role.provider,
    )
    session.add(other)
    await session.commit()
    mine = await own_listing(session, provider, "Mine Clinic")
    theirs = await own_listing(session, other, "Theirs Clinic")

    assert (await get_own(client, provider)).json()["id"] == mine.id
    assert (await get_own(client, other)).json()["id"] == theirs.id


async def test_a_listing_that_is_not_published_can_still_be_read_by_its_owner(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    provider = demo_users[Role.provider]
    await own_listing(session, provider, status=ListingStatus.hidden)

    response = await get_own(client, provider)

    assert response.status_code == 200
    assert response.json()["status"] == "hidden"


async def test_a_provider_with_no_linked_listing_gets_404(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    await add_listing(session, "Not Owned")
    await session.commit()

    response = await get_own(client, demo_users[Role.provider])

    assert response.status_code == 404
    assert response.json()["detail"] == "No listing is linked to your account."


@pytest.mark.parametrize("role", [Role.verifier, Role.editor, Role.admin])
async def test_staff_roles_get_403_on_both_calls(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None, role: Role
) -> None:
    await own_listing(session, demo_users[Role.provider])

    assert (await get_own(client, demo_users[role])).status_code == 403
    assert (await patch_own(client, demo_users[role], {"description": "x"})).status_code == 403


async def test_without_a_token_both_calls_are_401(client: AsyncClient, clock: None) -> None:
    assert (await get_own(client, None)).status_code == 401
    assert (await patch_own(client, None, {})).status_code == 401


async def test_a_deactivated_provider_is_refused_on_the_next_request(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    provider = demo_users[Role.provider]
    await own_listing(session, provider)
    provider.is_active = False
    session.add(provider)
    await session.commit()

    assert (await get_own(client, provider)).status_code == 403


# --- editing ---


async def test_the_description_changes_at_once_and_writes_an_audit_entry_but_no_recheck(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    provider = demo_users[Role.provider]
    listing = await own_listing(session, provider)

    response = await patch_own(client, provider, {"description": "Open every weekday. Fictional text."})

    assert response.status_code == 200
    assert response.json()["description"] == "Open every weekday. Fictional text."
    await session.refresh(listing)
    assert listing.description == "Open every weekday. Fictional text."
    assert listing.status == ListingStatus.published
    assert listing.next_check_due == NEXT_CHECK  # a description is not a reason for an urgent re-check
    [entry] = await audit(session)
    assert (entry.user_id, entry.listing_id, entry.action) == (provider.id, listing.id, "update")
    assert entry.field_changed == "description"


async def test_services_replace_the_list(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    provider = demo_users[Role.provider]
    listing = await own_listing(session, provider)

    response = await patch_own(
        client,
        provider,
        {"services": [{"name": "Malaria test", "fee_min_naira": "1500.00", "fee_max_naira": "3000.00"}]},
    )

    assert response.status_code == 200
    stored = (await session.exec(select(Service).where(Service.listing_id == listing.id))).all()
    assert [(service.name, str(service.fee_min_naira)) for service in stored] == [("Malaria test", "1500.00")]
    [entry] = await audit(session)
    assert entry.field_changed == "services"


@pytest.mark.parametrize(
    ("body", "field"),
    [
        ({"phones": [{"number": "08031112222", "label": "Desk", "is_primary": True}]}, "phones"),
        ({"opening_hours": [{"day_of_week": 1, "opens_at": "09:00", "closes_at": "18:00"}]}, "opening_hours"),
    ],
)
async def test_a_change_of_phones_or_hours_starts_an_urgent_recheck_and_the_listing_stays_visible(
    client: AsyncClient,
    session: AsyncSession,
    demo_users: dict[Role, User],
    clock: None,
    body: dict,
    field: str,
) -> None:
    provider = demo_users[Role.provider]
    listing = await own_listing(session, provider)

    response = await patch_own(client, provider, body)

    assert response.status_code == 200
    await session.refresh(listing)
    assert listing.next_check_due == NOW  # due now: first in the re-check list
    assert listing.status == ListingStatus.published  # not hidden
    entries = await audit(session)
    assert [entry.field_changed for entry in entries] == [field, "next_check_due"]
    assert entries[1].reference == "provider-change"
    assert entries[1].user_id == provider.id
    # A moment later the listing is still found, now with verification_due true (FR-08).
    later = NOW + timedelta(minutes=1)
    app.dependency_overrides[get_current_moment] = lambda: later
    found = await client.get("/search", params={"q": "Provider Clinic"})
    assert [(item["name"], item["verification_due"]) for item in found.json()["items"]] == [
        ("Provider Clinic", True)
    ]


async def test_the_same_phone_again_changes_nothing_and_starts_no_recheck(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    provider = demo_users[Role.provider]
    listing = await own_listing(session, provider, phone="+2348031112222")
    assert (await session.exec(select(PhoneNumber).where(PhoneNumber.listing_id == listing.id))).one()

    # The same number written the local way is the same number once normalised.
    response = await patch_own(
        client, provider, {"phones": [{"number": "0803 111 2222", "label": None, "is_primary": True}]}
    )

    assert response.status_code == 200
    await session.refresh(listing)
    assert listing.next_check_due == NEXT_CHECK
    assert await audit(session) == []


@pytest.mark.parametrize(
    "body",
    [
        {"name": "New Name"},
        {"category": "pharmacy"},
        {"area": "Ogui"},
        {"address": "9 Other Road"},
        {"latitude": 6.5},
        {"is_24_hours": True},
        {"status": "published"},
        {"owner_id": 1},
        {"featured_until": "2030-01-01T00:00:00Z"},
        {"description": "ok", "name": "New Name"},
    ],
)
async def test_any_other_field_is_422_and_nothing_changes(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None, body: dict
) -> None:
    provider = demo_users[Role.provider]
    listing = await own_listing(session, provider)

    response = await patch_own(client, provider, body)

    assert response.status_code == 422
    await session.refresh(listing)
    assert (listing.name, listing.description, listing.area) == ("Provider Clinic", None, "GRA")
    assert listing.featured_until is None
    assert await audit(session) == []


async def test_the_checks_of_the_staff_editor_apply_to_a_provider_too(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    provider = demo_users[Role.provider]
    await own_listing(session, provider)

    assert (await patch_own(client, provider, {"phones": []})).status_code == 422  # a listing needs a phone
    assert (
        await patch_own(client, provider, {"phones": [{"number": "12345", "is_primary": True}]})
    ).status_code == 422
    assert (await patch_own(client, provider, {"services": [{"name": "Not in the list"}]})).status_code == 422
    assert (await patch_own(client, provider, {"description": "x" * 1001})).status_code == 422


async def test_an_empty_body_changes_nothing(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    provider = demo_users[Role.provider]
    await own_listing(session, provider)

    response = await patch_own(client, provider, {})

    assert response.status_code == 200
    assert await audit(session) == []


async def test_a_provider_with_no_listing_cannot_patch(
    client: AsyncClient, demo_users: dict[Role, User], clock: None
) -> None:
    response = await patch_own(client, demo_users[Role.provider], {"description": "x"})

    assert response.status_code == 404

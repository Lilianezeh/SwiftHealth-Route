"""The owner form, part (b): the exact location and the entrance photo.
Requirements: US-17, US-02, FR-50, FR-32, FR-31, NFR-06, NFR-07.
Spec: specs/2026-11-01-owner-form-location-photo/ (decisions L1 to L11).

The owner's pin is optional (L5); a pin outside Nigeria or one coordinate alone is refused (L6). A photo
address is accepted only inside the owner folder of our Cloudinary account (L8). In a save, an absent
latitude, longitude or photo keeps what is stored, and an explicit null photo removes it (L9). Cloudinary
is never called. Every name, number and address is fictional.
"""

from collections.abc import Iterator
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment
from app.core.config import DEFAULT_MAP_CENTRE, settings
from app.main import app
from app.models import AuditEntry, Listing, User
from app.models.base import Role
from tests.factories import get_or_add_category
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 11, 1, 9, 0, tzinfo=timezone.utc)
PHOTO = "https://res.cloudinary.com/demo-cloud/image/upload/v1730000000/swifthealth/owner-entrances/front.jpg"
FORM = {
    "facility_name": "Pin Clinic",
    "category": "clinic",
    "area": "Ogui",
    "address": "4 Example Street",
    "phone": "08030000777",
    "save_as_draft": True,
}


@pytest.fixture(autouse=True)
def clock() -> Iterator[None]:
    app.dependency_overrides[get_current_moment] = lambda: NOW
    yield
    app.dependency_overrides.pop(get_current_moment, None)


@pytest.fixture(autouse=True)
async def clinic_category(session: AsyncSession) -> None:
    await get_or_add_category(session, "clinic", "Clinic")
    await session.commit()


@pytest.fixture(autouse=True)
def cloudinary_account(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "cloudinary_url", "cloudinary://123456789012345:secret-not-real@demo-cloud")


@pytest.fixture
def provider(demo_users: dict[Role, User]) -> User:
    return demo_users[Role.provider]


async def register(client: AsyncClient, user: User, **changes: object):
    return await client.post(
        "/provider/facilities",
        json={**FORM, **changes},
        headers={**bearer_for(user), "x-forwarded-for": "203.0.113.41"},
    )


async def save(client: AsyncClient, user: User, link_id: int, **changes: object):
    return await client.put(
        f"/provider/requests/{link_id}", json={**FORM, **changes}, headers=bearer_for(user)
    )


async def the_listing(session: AsyncSession, listing_id: int) -> Listing:
    listing = await session.get(Listing, listing_id, populate_existing=True)
    assert listing is not None
    return listing


async def audit_fields(session: AsyncSession, listing_id: int) -> set[str | None]:
    rows = await session.exec(
        select(AuditEntry).where(AuditEntry.listing_id == listing_id, AuditEntry.action == "update")
    )
    return {entry.field_changed for entry in rows.all()}


# ---------- the pin ----------


async def test_the_pin_the_owner_chose_is_saved_and_staff_see_it_is_not_the_default(
    client: AsyncClient, session: AsyncSession, provider: User, demo_users: dict[Role, User]
) -> None:
    saved = (await register(client, provider, latitude=6.4521, longitude=7.5103)).json()

    listing = await the_listing(session, saved["listing_id"])
    detail = await client.get(f"/listings/id/{listing.id}", headers=bearer_for(demo_users[Role.editor]))

    assert (listing.latitude, listing.longitude) == (6.4521, 7.5103)
    assert detail.json()["map_pin_is_default"] is False


async def test_without_a_pin_the_listing_keeps_the_default_centre(
    client: AsyncClient, session: AsyncSession, provider: User, demo_users: dict[Role, User]
) -> None:
    saved = (await register(client, provider)).json()

    listing = await the_listing(session, saved["listing_id"])
    detail = await client.get(f"/listings/id/{listing.id}", headers=bearer_for(demo_users[Role.editor]))

    assert (listing.latitude, listing.longitude) == DEFAULT_MAP_CENTRE
    assert detail.json()["map_pin_is_default"] is True


@pytest.mark.parametrize(
    "changes",
    [
        {"latitude": 6.45},  # both or neither
        {"longitude": 7.5},
        {"latitude": 6.45, "longitude": None},
        {"latitude": 51.5, "longitude": -0.12},  # London: not Nigeria
        {"latitude": 0, "longitude": 0},
        {"latitude": 3.9, "longitude": 7.5},
        {"latitude": 6.45, "longitude": 15.1},
        {"latitude": "north", "longitude": 7.5},
    ],
)
async def test_a_half_pin_or_one_outside_nigeria_is_a_422_and_nothing_is_saved(
    client: AsyncClient, session: AsyncSession, provider: User, changes: dict
) -> None:
    response = await register(client, provider, **changes)

    assert response.status_code == 422
    assert (await session.exec(select(Listing).where(Listing.name == "Pin Clinic"))).first() is None


async def test_a_save_without_a_pin_keeps_the_stored_one_and_a_save_with_one_moves_it(
    client: AsyncClient, session: AsyncSession, provider: User
) -> None:
    saved = (await register(client, provider, latitude=6.4521, longitude=7.5103)).json()

    kept = await save(client, provider, saved["link_id"], description="No pin sent")
    assert kept.status_code == 200
    listing = await the_listing(session, saved["listing_id"])
    assert (listing.latitude, listing.longitude) == (6.4521, 7.5103)

    moved = await save(client, provider, saved["link_id"], latitude=6.46, longitude=7.52)
    assert moved.status_code == 200
    listing = await the_listing(session, saved["listing_id"])
    assert (listing.latitude, listing.longitude) == (6.46, 7.52)
    assert {"latitude", "longitude"} <= await audit_fields(session, saved["listing_id"])


async def test_the_request_reads_back_with_its_pin_and_whether_it_is_the_default(
    client: AsyncClient, provider: User
) -> None:
    placed = (await register(client, provider, latitude=6.4521, longitude=7.5103)).json()
    unplaced = (await register(client, provider, facility_name="Zebra Hospital", phone="08030000778")).json()

    first = (await client.get(f"/provider/requests/{placed['link_id']}", headers=bearer_for(provider))).json()
    second = (
        await client.get(f"/provider/requests/{unplaced['link_id']}", headers=bearer_for(provider))
    ).json()

    assert (first["latitude"], first["longitude"], first["map_pin_is_default"]) == (6.4521, 7.5103, False)
    assert second["map_pin_is_default"] is True


# ---------- the photo ----------


async def test_a_photo_in_the_owner_folder_is_saved_and_read_back(
    client: AsyncClient, session: AsyncSession, provider: User
) -> None:
    saved = (await register(client, provider, entrance_photo_url=PHOTO)).json()

    listing = await the_listing(session, saved["listing_id"])
    read = (await client.get(f"/provider/requests/{saved['link_id']}", headers=bearer_for(provider))).json()

    assert listing.entrance_photo_url == PHOTO
    assert read["entrance_photo_url"] == PHOTO


@pytest.mark.parametrize(
    "address",
    [
        "http://res.cloudinary.com/demo-cloud/image/upload/swifthealth/owner-entrances/a.jpg",  # not https
        "https://example.com/demo-cloud/image/upload/swifthealth/owner-entrances/a.jpg",  # not Cloudinary
        "https://res.cloudinary.com.evil.example/demo-cloud/swifthealth/owner-entrances/a.jpg",
        "https://user:pass@res.cloudinary.com/demo-cloud/image/upload/swifthealth/owner-entrances/a.jpg",
        "https://res.cloudinary.com:8443/demo-cloud/image/upload/swifthealth/owner-entrances/a.jpg",
        "https://res.cloudinary.com/other-cloud/image/upload/swifthealth/owner-entrances/a.jpg",  # not ours
        "https://res.cloudinary.com/demo-cloud/image/upload/swifthealth/entrances/a.jpg",  # the staff folder
        "https://res.cloudinary.com/demo-cloud/image/upload/somewhere/else/a.jpg",
        "javascript:alert(1)",
        "not an address",
    ],
)
async def test_a_photo_outside_the_owner_folder_of_our_account_is_a_422(
    client: AsyncClient, session: AsyncSession, provider: User, address: str
) -> None:
    response = await register(client, provider, entrance_photo_url=address)

    assert response.status_code == 422
    assert (await session.exec(select(Listing).where(Listing.name == "Pin Clinic"))).first() is None


async def test_a_save_without_the_photo_keeps_it_and_an_explicit_null_removes_it(
    client: AsyncClient, session: AsyncSession, provider: User
) -> None:
    saved = (await register(client, provider, entrance_photo_url=PHOTO)).json()

    await save(client, provider, saved["link_id"], description="No photo sent")
    assert (await the_listing(session, saved["listing_id"])).entrance_photo_url == PHOTO

    removed = await save(client, provider, saved["link_id"], entrance_photo_url=None)
    assert removed.status_code == 200
    assert (await the_listing(session, saved["listing_id"])).entrance_photo_url is None
    assert "entrance_photo_url" in await audit_fields(session, saved["listing_id"])


async def test_a_new_photo_replaces_the_old_one_with_an_audit_entry(
    client: AsyncClient, session: AsyncSession, provider: User
) -> None:
    saved = (await register(client, provider, entrance_photo_url=PHOTO)).json()
    newer = PHOTO.replace("front.jpg", "side.jpg")

    await save(client, provider, saved["link_id"], entrance_photo_url=newer)

    assert (await the_listing(session, saved["listing_id"])).entrance_photo_url == newer
    entries = await session.exec(
        select(AuditEntry).where(
            AuditEntry.listing_id == saved["listing_id"], AuditEntry.field_changed == "entrance_photo_url"
        )
    )
    [entry] = entries.all()
    assert (entry.old_value, entry.new_value) == (PHOTO, newer)

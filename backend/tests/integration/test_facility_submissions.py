"""POST /facility-submissions ("List your facility"). Requirements: FR-37, FR-38, NFR-06, NFR-07.
Contract: specs/backend/api-spec.md, "POST /facility-submissions". Decisions C5, C6 and C7 in
specs/2026-10-20-staff-screens/requirements.md.
"""

from collections.abc import Iterator
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment
from app.core.config import DEFAULT_MAP_CENTRE
from app.main import app
from app.models import AuditEntry, Listing, PhoneNumber, User
from app.models.base import ListingStatus, Role
from tests.factories import get_or_add_category
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 10, 6, 9, 0, tzinfo=timezone.utc)
BODY = {
    "facility_name": "Example Clinic",
    "category": "clinic",
    "area": "Trans-Ekulu",
    "address": "4 Example Street",
    "phone": "08030000000",
    "contact_name": "Dr. Example",
    "contact_email": "owner@example.com",
    "notes": "Open 24 hours",
}
THANKS = "Thanks. Our team will verify your facility before it is listed."


@pytest.fixture
def clock() -> Iterator[None]:
    app.dependency_overrides[get_current_moment] = lambda: NOW
    yield
    app.dependency_overrides.pop(get_current_moment, None)


@pytest.fixture
async def categories(session: AsyncSession) -> None:
    await get_or_add_category(session, "clinic", "Clinic")
    ambulance = await get_or_add_category(session, "ambulance", "Ambulance")
    ambulance.is_emergency = True
    session.add(ambulance)
    await session.commit()


async def submit(client: AsyncClient, ip: str = "203.0.113.5", **changes: object):
    body = {**BODY, **changes}
    return await client.post("/facility-submissions", json=body, headers={"x-forwarded-for": ip})


async def test_a_submission_needs_no_login_and_answers_201_with_the_thanks(
    client: AsyncClient, clock: None, categories: None
) -> None:
    response = await submit(client)
    assert response.status_code == 201, response.text
    assert response.json() == {"message": THANKS}


async def test_it_creates_one_draft_with_no_creator_and_the_default_pin(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None
) -> None:
    await submit(client)
    [listing] = (await session.exec(select(Listing))).all()
    assert listing.status == ListingStatus.draft
    assert listing.created_by is None
    assert listing.owner_id is None
    assert (listing.name, listing.area, listing.address) == (
        "Example Clinic",
        "Trans-Ekulu",
        "4 Example Street",
    )
    assert (listing.latitude, listing.longitude) == DEFAULT_MAP_CENTRE
    assert listing.slug == "example-clinic-trans-ekulu"
    assert listing.description is None
    assert listing.last_verified_at is None


async def test_the_phone_is_stored_as_the_primary_number_in_plus_234(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None
) -> None:
    await submit(client, phone="0803 000 0000")
    [phone] = (await session.exec(select(PhoneNumber))).all()
    assert (phone.number, phone.is_primary, phone.is_whatsapp) == ("+2348030000000", True, False)


async def test_the_contact_details_are_in_an_audit_entry_only_never_in_the_listing(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None
) -> None:
    await submit(client)
    [listing] = (await session.exec(select(Listing))).all()
    entries = (await session.exec(select(AuditEntry).order_by(AuditEntry.id))).all()
    assert [(entry.action, entry.user_id) for entry in entries] == [("create", None), ("submission", None)]
    submission = entries[1]
    assert submission.field_changed == "contact"
    assert submission.new_value == "Contact: Dr. Example, owner@example.com. Notes: Open 24 hours"
    assert submission.listing_id == listing.id
    stored_in_the_listing = " ".join(str(value) for value in listing.model_dump().values())
    assert "owner@example.com" not in stored_in_the_listing and "Dr. Example" not in stored_in_the_listing


async def test_notes_are_optional(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None
) -> None:
    assert (await submit(client, notes=None)).status_code == 201
    entry = (await session.exec(select(AuditEntry).where(AuditEntry.action == "submission"))).one()
    assert entry.new_value == "Contact: Dr. Example, owner@example.com."


async def test_the_draft_is_not_public_and_is_in_the_staff_list(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None, categories: None
) -> None:
    await submit(client)
    assert (await client.get("/search")).json()["total"] == 0
    assert (await client.get("/listings/example-clinic-trans-ekulu")).status_code == 404
    staff = (await client.get("/listings", headers=bearer_for(demo_users[Role.verifier]))).json()
    assert [(item["name"], item["status"]) for item in staff["items"]] == [("Example Clinic", "draft")]
    detail = (
        await client.get(
            f"/listings/id/{staff['items'][0]['id']}", headers=bearer_for(demo_users[Role.verifier])
        )
    ).json()
    assert detail["map_pin_is_default"] is True
    assert "owner@example.com" in detail["submission_details"]


async def test_the_contact_details_are_in_no_public_answer(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None
) -> None:
    await submit(client)
    for path in ("/search", "/meta", "/emergency", "/listings/example-clinic-trans-ekulu"):
        assert "owner@example.com" not in (await client.get(path)).text, path


@pytest.mark.parametrize(
    "changes",
    [
        {"category": "ambulance"},
        {"category": "no-such-category"},
        {"area": "Atlantis"},
        {"facility_name": "A"},
        {"facility_name": "x" * 121},
        {"address": "ab"},
        {"phone": ""},
        {"phone": "12345"},
        {"contact_name": ""},
        {"contact_email": "not an email"},
        {"contact_email": "a@b"},
        {"contact_email": "a" * 300 + "@example.com"},
        {"notes": "x" * 501},
    ],
)
async def test_bad_input_is_422_and_nothing_is_stored(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None, changes: dict
) -> None:
    response = await submit(client, **changes)
    assert response.status_code == 422, response.text
    assert (await session.exec(select(Listing))).all() == []
    assert (await session.exec(select(AuditEntry))).all() == []


@pytest.mark.parametrize(
    "missing", ["facility_name", "category", "area", "address", "phone", "contact_name", "contact_email"]
)
async def test_every_field_but_the_notes_is_required(
    client: AsyncClient, clock: None, categories: None, missing: str
) -> None:
    body = {key: value for key, value in BODY.items() if key != missing}
    response = await client.post(
        "/facility-submissions", json=body, headers={"x-forwarded-for": "203.0.113.5"}
    )
    assert response.status_code == 422


async def test_the_fourth_submission_from_one_address_in_a_day_is_429(
    client: AsyncClient, clock: None, categories: None
) -> None:
    for number in range(3):
        assert (await submit(client, facility_name=f"Clinic {number}")).status_code == 201
    fourth = await submit(client, facility_name="Clinic 4")
    assert fourth.status_code == 429
    assert fourth.json() == {"detail": "You've sent several submissions. Please try again tomorrow."}
    assert (await submit(client, ip="198.51.100.9")).status_code == 201


async def test_two_submissions_with_the_same_name_get_different_slugs(
    client: AsyncClient, session: AsyncSession, clock: None, categories: None
) -> None:
    await submit(client)
    await submit(client)
    slugs = sorted(listing.slug for listing in (await session.exec(select(Listing))).all())
    assert slugs == ["example-clinic-trans-ekulu", "example-clinic-trans-ekulu-2"]

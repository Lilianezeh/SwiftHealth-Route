"""Staff review of an owner request, and "Request changes".
Requirements: US-17, FR-50, FR-31, NFR-06, NFR-07.
Spec: specs/2026-11-01-owner-form-location-photo/ (decisions L4, L10, L11) and api-spec section 7.

In Owner requests staff see every field of the request, with the pin. They can send a paid request back
with a note (the link becomes `changes_requested`); the note is kept in the audit log. The owner reads the
note, edits and sends again, and the request is back in the queue without a new payment. Every name here
is fictional.
"""

from collections.abc import Iterator
from datetime import datetime, time, timezone

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment
from app.main import app
from app.models import AuditEntry, FacilityOwner, OpeningHours, PhoneNumber, Service, User
from app.models.base import ListingStatus, Role
from tests.factories import add_listing, add_owner_link, get_or_add_category
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 11, 1, 9, 0, tzinfo=timezone.utc)
PHOTO = "https://res.cloudinary.com/demo-cloud/image/upload/v1/swifthealth/owner-entrances/front.jpg"
NOTE = "Please check the address and add the pharmacy number."


@pytest.fixture(autouse=True)
def clock() -> Iterator[None]:
    app.dependency_overrides[get_current_moment] = lambda: NOW
    yield
    app.dependency_overrides.pop(get_current_moment, None)


@pytest.fixture(autouse=True)
async def clinic_category(session: AsyncSession) -> None:
    await get_or_add_category(session, "clinic", "Clinic")
    await session.commit()


async def pending_request(session: AsyncSession, provider: User, name: str = "Review Clinic"):
    """A paid request: a draft listing with every field, and a `pending` link."""
    listing = await add_listing(
        session,
        name,
        category_slug="clinic",
        area="Ogui",
        latitude=6.4521,
        longitude=7.5103,
        status=ListingStatus.draft,
        phones=[
            PhoneNumber(
                listing_id=0, number="+2348030000001", label="Front desk", is_primary=True, is_whatsapp=True
            ),
            PhoneNumber(
                listing_id=0, number="+2348030000002", label="Pharmacy", is_primary=False, is_whatsapp=False
            ),
        ],
        opening_hours=[
            OpeningHours(
                listing_id=0, day_of_week=0, opens_at=time(8, 0), closes_at=time(17, 0), is_closed=False
            ),
            OpeningHours(listing_id=0, day_of_week=6, opens_at=None, closes_at=None, is_closed=True),
        ],
        services=[Service(listing_id=0, name="Consultation"), Service(listing_id=0, name="X-ray")],
    )
    listing.landmark, listing.description = "Behind the market", "A small clinic."
    listing.email, listing.entrance_photo_url = "front-desk@clinic.example.com", PHOTO
    session.add(listing)
    link = await add_owner_link(session, listing, provider, status="pending")
    await session.commit()
    return listing, link


async def queue(client: AsyncClient, staff: User):
    return await client.get("/staff/owner-requests", headers=bearer_for(staff))


async def request_changes(client: AsyncClient, user: User | None, link_id: int, note: object = NOTE):
    headers = bearer_for(user) if user else {}
    return await client.post(
        f"/staff/owner-requests/{link_id}/request-changes", json={"note": note}, headers=headers
    )


# ---------- staff see every field ----------


async def test_the_queue_shows_every_field_of_the_request_with_the_pin(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    listing, _ = await pending_request(session, demo_users[Role.provider])

    body = (await queue(client, demo_users[Role.editor])).json()

    [item] = body["items"]
    shown = item["listing"]
    assert shown["name"] == "Review Clinic" and shown["area"] == "Ogui"
    assert shown["category"] == {"slug": "clinic", "name": "Clinic"}
    assert (shown["address"], shown["landmark"], shown["description"]) == (
        "1 Example Road",
        "Behind the market",
        "A small clinic.",
    )
    assert shown["email"] == "front-desk@clinic.example.com"  # staff only: this is a staff route
    assert (shown["latitude"], shown["longitude"], shown["map_pin_is_default"]) == (6.4521, 7.5103, False)
    assert shown["entrance_photo_url"] == PHOTO
    assert shown["is_24_hours"] is False
    assert [(p["number"], p["label"], p["is_primary"], p["is_whatsapp"]) for p in shown["phones"]] == [
        ("+2348030000001", "Front desk", True, True),
        ("+2348030000002", "Pharmacy", False, False),
    ]
    assert [(h["day_of_week"], h["opens_at"], h["is_closed"]) for h in shown["opening_hours"]] == [
        (0, "08:00:00", False),
        (6, None, True),
    ]
    assert sorted(shown["services"]) == ["Consultation", "X-ray"]
    assert shown["id"] == listing.id


async def test_a_request_whose_pin_was_never_placed_says_so(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    from app.core.config import DEFAULT_MAP_CENTRE

    listing, _ = await pending_request(session, demo_users[Role.provider])
    listing.latitude, listing.longitude = DEFAULT_MAP_CENTRE
    session.add(listing)
    await session.commit()

    [item] = (await queue(client, demo_users[Role.editor])).json()["items"]

    assert item["listing"]["map_pin_is_default"] is True


async def test_the_queue_is_still_for_editors_and_admins_only(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    await pending_request(session, demo_users[Role.provider])

    assert (await client.get("/staff/owner-requests")).status_code == 401
    assert (await queue(client, demo_users[Role.verifier])).status_code == 403
    assert (await queue(client, demo_users[Role.provider])).status_code == 403


# ---------- Request changes ----------


async def test_requesting_changes_sends_the_link_back_and_keeps_the_note_in_the_audit_log(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    editor, provider = demo_users[Role.editor], demo_users[Role.provider]
    listing, link = await pending_request(session, provider)

    response = await request_changes(client, editor, link.id)

    assert response.status_code == 200
    assert response.json()["status"] == "changes_requested"
    assert (await queue(client, editor)).json()["total"] == 0  # it waits for the owner now
    kept = await session.get(FacilityOwner, link.id, populate_existing=True)
    assert kept is not None and kept.paid_until is not None  # still paid
    entries = (await session.exec(select(AuditEntry).where(AuditEntry.listing_id == listing.id))).all()
    status_entry = next(entry for entry in entries if entry.action == "owner_changes_requested")
    note_entry = next(entry for entry in entries if entry.action == "owner_changes_note")
    assert (status_entry.old_value, status_entry.new_value, status_entry.user_id) == (
        "pending",
        "changes_requested",
        editor.id,
    )
    assert status_entry.reference == f"user:{provider.id}"
    assert note_entry.new_value == NOTE and note_entry.user_id == editor.id


async def test_an_admin_may_request_changes_too(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    _, link = await pending_request(session, demo_users[Role.provider])

    assert (await request_changes(client, demo_users[Role.admin], link.id)).status_code == 200


async def test_only_an_editor_or_admin_may_request_changes(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    _, link = await pending_request(session, demo_users[Role.provider])

    assert (await request_changes(client, None, link.id)).status_code == 401
    assert (await request_changes(client, demo_users[Role.verifier], link.id)).status_code == 403
    assert (await request_changes(client, demo_users[Role.provider], link.id)).status_code == 403


@pytest.mark.parametrize("note", ["", "   ", "x" * 301, None, 5])
async def test_the_note_is_required_and_at_most_300_characters(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], note: object
) -> None:
    _, link = await pending_request(session, demo_users[Role.provider])

    assert (await request_changes(client, demo_users[Role.editor], link.id, note)).status_code == 422
    unchanged = await session.get(FacilityOwner, link.id, populate_existing=True)
    assert unchanged is not None and unchanged.status == "pending"


@pytest.mark.parametrize("state", ["draft", "awaiting_payment", "changes_requested", "approved", "removed"])
async def test_only_a_request_that_waits_for_staff_can_be_sent_back(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], state: str
) -> None:
    listing = await add_listing(
        session, f"State {state} Clinic", category_slug="clinic", status=ListingStatus.draft
    )
    link = await add_owner_link(session, listing, demo_users[Role.provider], status=state)
    await session.commit()

    assert (await request_changes(client, demo_users[Role.editor], link.id)).status_code == 409


async def test_an_unknown_request_is_404(client: AsyncClient, demo_users: dict[Role, User]) -> None:
    assert (await request_changes(client, demo_users[Role.editor], 99999)).status_code == 404


# ---------- the owner's side ----------


async def test_the_owner_reads_the_note_and_it_is_not_shown_to_anyone_else(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    editor, provider = demo_users[Role.editor], demo_users[Role.provider]
    _, link = await pending_request(session, provider)
    await request_changes(client, editor, link.id)

    read = (await client.get(f"/provider/requests/{link.id}", headers=bearer_for(provider))).json()
    mine = (await client.get("/provider/listings", headers=bearer_for(provider))).json()["items"]

    assert (read["status"], read["change_note"]) == ("changes_requested", NOTE)
    assert [(item["status"], item["change_note"]) for item in mine] == [("changes_requested", NOTE)]


async def test_a_request_that_was_never_sent_back_has_no_note(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    provider = demo_users[Role.provider]
    _, link = await pending_request(session, provider)

    read = (await client.get(f"/provider/requests/{link.id}", headers=bearer_for(provider))).json()
    mine = (await client.get("/provider/listings", headers=bearer_for(provider))).json()["items"]

    assert read["change_note"] is None and mine[0]["change_note"] is None


async def test_the_owner_edits_and_sends_again_and_the_request_is_back_in_the_queue_with_the_old_note(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    editor, provider = demo_users[Role.editor], demo_users[Role.provider]
    listing, link = await pending_request(session, provider)
    await request_changes(client, editor, link.id)
    paid_until = (await session.get(FacilityOwner, link.id, populate_existing=True)).paid_until

    sent = await client.put(
        f"/provider/requests/{link.id}",
        headers=bearer_for(provider),
        json={
            "facility_name": "Review Clinic",
            "category": "clinic",
            "area": "Ogui",
            "address": "12 Corrected Street",
            "phone": "08030000001",
            "save_as_draft": False,
        },
    )

    assert sent.status_code == 200 and sent.json()["status"] == "pending"
    again = await session.get(FacilityOwner, link.id, populate_existing=True)
    assert again is not None and again.paid_until == paid_until  # no new payment
    [item] = (await queue(client, editor)).json()["items"]
    assert item["id"] == link.id
    assert item["listing"]["address"] == "12 Corrected Street"
    assert item["previous_change_note"] == NOTE


async def test_a_first_request_has_no_previous_note(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    await pending_request(session, demo_users[Role.provider])

    [item] = (await queue(client, demo_users[Role.editor])).json()["items"]

    assert item["previous_change_note"] is None

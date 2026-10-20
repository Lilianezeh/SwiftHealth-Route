"""GET /listings and GET /listings/id/{id} for staff. Requirements: FR-31, FR-42, NFR-06, FR-08.
Contract: specs/backend/api-spec.md, section 5 and "Phase 10 clarifications". Decisions C3 and C5 in
specs/2026-10-20-staff-screens/requirements.md.
"""

from collections.abc import Iterator
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment
from app.core.config import DEFAULT_MAP_CENTRE
from app.main import app
from app.models import AuditEntry, User
from app.models.base import ListingStatus, Role
from tests.factories import add_listing
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 10, 6, 9, 0, tzinfo=timezone.utc)
STAFF_ROLES = [Role.verifier, Role.editor, Role.admin]


@pytest.fixture
def clock() -> Iterator[None]:
    app.dependency_overrides[get_current_moment] = lambda: NOW
    yield
    app.dependency_overrides.pop(get_current_moment, None)


async def staff_list(client: AsyncClient, user: User, **params: object) -> dict:
    response = await client.get("/listings", params=params, headers=bearer_for(user))
    assert response.status_code == 200, response.text
    return response.json()


def names(body: dict) -> list[str]:
    return [item["name"] for item in body["items"]]


async def test_the_staff_list_needs_a_login(client: AsyncClient, clock: None) -> None:
    assert (await client.get("/listings")).status_code == 401


@pytest.mark.parametrize("role", [Role.provider])
async def test_a_provider_cannot_use_the_staff_list(
    client: AsyncClient, demo_users: dict[Role, User], clock: None, role: Role
) -> None:
    response = await client.get("/listings", headers=bearer_for(demo_users[role]))
    assert response.status_code == 403


@pytest.mark.parametrize("role", STAFF_ROLES)
async def test_every_staff_role_sees_listings_of_every_status(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None, role: Role
) -> None:
    for status in ListingStatus:
        await add_listing(session, f"Place {status.value}", status=status)
    await session.commit()
    body = await staff_list(client, demo_users[role])
    assert body["total"] == 5
    assert names(body) == sorted(f"Place {status.value}" for status in ListingStatus)


async def test_a_staff_item_is_a_summary_plus_status_next_check_and_creator(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    due = NOW + timedelta(days=3)
    listing = await add_listing(session, "Place", status=ListingStatus.draft, next_check_due=due)
    listing.created_by = demo_users[Role.verifier].id
    session.add(listing)
    await session.commit()
    [item] = (await staff_list(client, demo_users[Role.editor]))["items"]
    assert item["status"] == "draft"
    assert item["next_check_due"] == "2026-10-09T09:00:00Z"
    assert item["created_by"] == demo_users[Role.verifier].id
    assert {"id", "slug", "name", "category", "area", "address", "primary_phone", "is_open_now"} <= set(item)


async def test_filters_status_category_area_and_text(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    await add_listing(
        session, "Alpha Clinic", category_slug="clinic", area="Ogui", status=ListingStatus.draft
    )
    await add_listing(session, "Beta Pharmacy", category_slug="pharmacy", area="GRA")
    await add_listing(session, "Gamma Pharmacy", category_slug="pharmacy", area="Ogui")
    await session.commit()
    editor = demo_users[Role.editor]
    assert names(await staff_list(client, editor, status="draft")) == ["Alpha Clinic"]
    assert names(await staff_list(client, editor, category="pharmacy")) == ["Beta Pharmacy", "Gamma Pharmacy"]
    assert names(await staff_list(client, editor, area="Ogui")) == ["Alpha Clinic", "Gamma Pharmacy"]
    assert names(await staff_list(client, editor, q="pharm")) == ["Beta Pharmacy", "Gamma Pharmacy"]
    assert names(await staff_list(client, editor, q="  ALPHA ")) == ["Alpha Clinic"]
    assert names(await staff_list(client, editor, status="draft", area="GRA")) == []


async def test_the_text_filter_matches_a_percent_sign_literally(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    await add_listing(session, "Plain Place")
    await session.commit()
    assert (await staff_list(client, demo_users[Role.editor], q="%"))["total"] == 0


async def test_mine_shows_only_what_the_caller_created(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    mine = await add_listing(session, "Mine", status=ListingStatus.draft)
    other = await add_listing(session, "Not mine", status=ListingStatus.draft)
    mine.created_by = demo_users[Role.verifier].id
    other.created_by = demo_users[Role.editor].id
    session.add_all([mine, other])
    await session.commit()
    assert names(await staff_list(client, demo_users[Role.verifier], mine="true")) == ["Mine"]
    assert names(await staff_list(client, demo_users[Role.verifier])) == ["Mine", "Not mine"]


async def test_due_overdue_and_this_week(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    await add_listing(session, "Overdue", next_check_due=NOW - timedelta(days=1))
    await add_listing(session, "Soon", next_check_due=NOW + timedelta(days=6))
    await add_listing(session, "Later", next_check_due=NOW + timedelta(days=8))
    await add_listing(session, "Never", next_check_due=None)
    await session.commit()
    editor = demo_users[Role.editor]
    assert names(await staff_list(client, editor, due="overdue")) == ["Overdue"]
    assert names(await staff_list(client, editor, due="this_week")) == ["Soon"]
    assert (
        await client.get("/listings", params={"due": "whenever"}, headers=bearer_for(editor))
    ).status_code == 422


async def test_paging_is_by_name_then_id_and_the_total_is_the_whole_count(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    for number in range(5):
        await add_listing(session, f"Place {number}")
    await session.commit()
    editor = demo_users[Role.editor]
    first = await staff_list(client, editor, limit=2, offset=0)
    second = await staff_list(client, editor, limit=2, offset=2)
    assert first["total"] == second["total"] == 5
    assert names(first) + names(second) == ["Place 0", "Place 1", "Place 2", "Place 3"]
    assert (
        await client.get("/listings", params={"limit": 101}, headers=bearer_for(editor))
    ).status_code == 422


async def test_the_staff_detail_has_every_status_and_the_internal_fields(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    listing = await add_listing(session, "Hidden Place", status=ListingStatus.hidden)
    listing.owner_id = demo_users[Role.provider].id
    listing.created_by = demo_users[Role.verifier].id
    session.add(listing)
    await session.commit()
    response = await client.get(f"/listings/id/{listing.id}", headers=bearer_for(demo_users[Role.verifier]))
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "hidden"
    assert body["owner_id"] == demo_users[Role.provider].id
    assert body["created_by"] == demo_users[Role.verifier].id
    assert {"featured_until", "next_check_due", "map_pin_is_default", "submission_details"} <= set(body)
    assert len(body["opening_hours"]) == 7
    assert body["submission_details"] is None
    assert body["map_pin_is_default"] is False


async def test_the_map_pin_is_flagged_while_it_is_the_default_centre(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    listing = await add_listing(
        session, "Default Pin", latitude=DEFAULT_MAP_CENTRE[0], longitude=DEFAULT_MAP_CENTRE[1]
    )
    await session.commit()
    body = (
        await client.get(f"/listings/id/{listing.id}", headers=bearer_for(demo_users[Role.editor]))
    ).json()
    assert body["map_pin_is_default"] is True


async def test_the_staff_detail_shows_the_submission_details_for_staff_only(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    listing = await add_listing(session, "Submitted", status=ListingStatus.draft)
    session.add(
        AuditEntry(
            listing_id=listing.id,
            action="submission",
            field_changed="contact",
            new_value="Contact: Dr. Example, owner@example.com. Notes: Open 24 hours",
        )
    )
    await session.commit()
    body = (
        await client.get(f"/listings/id/{listing.id}", headers=bearer_for(demo_users[Role.verifier]))
    ).json()
    assert body["submission_details"] == "Contact: Dr. Example, owner@example.com. Notes: Open 24 hours"
    assert (
        await client.get(f"/listings/{listing.slug}")
    ).status_code == 404  # the public sees nothing of a draft


async def test_an_unknown_id_is_404_and_a_provider_or_a_visitor_cannot_read_a_staff_detail(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    listing = await add_listing(session, "Place")
    await session.commit()
    editor_headers = bearer_for(demo_users[Role.editor])
    assert (await client.get("/listings/id/99999", headers=editor_headers)).status_code == 404
    assert (await client.get(f"/listings/id/{listing.id}")).status_code == 401
    provider_headers = bearer_for(demo_users[Role.provider])
    assert (await client.get(f"/listings/id/{listing.id}", headers=provider_headers)).status_code == 403


async def test_a_deactivated_staff_user_is_blocked_on_the_next_request(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    editor = demo_users[Role.editor]
    headers = bearer_for(editor)
    assert (await client.get("/listings", headers=headers)).status_code == 200
    editor.is_active = False
    session.add(editor)
    await session.commit()
    assert (
        await client.get("/listings", headers=headers)
    ).status_code == 403  # role and is_active come from the row


async def test_the_public_search_and_page_still_show_only_published_listings(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    await add_listing(session, "Public One")
    await add_listing(session, "Draft One", status=ListingStatus.draft)
    await session.commit()
    body = (await client.get("/search")).json()
    assert [item["name"] for item in body["items"]] == ["Public One"]

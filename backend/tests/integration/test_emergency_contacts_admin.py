"""The SwiftRescue contacts for staff. Requirements: FR-15, FR-19, FR-31, FR-32, FR-38, NFR-06.
Contract: specs/backend/api-spec.md, section 5, "SwiftRescue contacts for staff" (2026-10-27).

One screen for an editor or admin to add, edit and remove the contacts of every SwiftRescue group. Removing is
hiding: nothing is deleted. Every name and number here is fictional; no real phone number is used.
"""

from collections.abc import Iterator
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment
from app.main import app
from app.models import AuditEntry, Listing, User
from app.models.base import ListingStatus, Role
from app.services.emergency_service import GROUPS
from tests.factories import add_listing, get_or_add_category
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 10, 27, 9, 0, tzinfo=timezone.utc)
FICTIONAL = "+2340000000777"


@pytest.fixture
def clock() -> Iterator[None]:
    app.dependency_overrides[get_current_moment] = lambda: NOW
    yield
    app.dependency_overrides.pop(get_current_moment, None)


@pytest.fixture
async def categories(session: AsyncSession) -> None:
    for slug, name in GROUPS:
        category = await get_or_add_category(session, slug, name)
        category.is_emergency = True
        session.add(category)
    await get_or_add_category(session, "pharmacy", "Pharmacy")
    await session.commit()


async def contact(session: AsyncSession, name: str, slug: str = "ambulance", **kwargs: object) -> Listing:
    kwargs.setdefault("phone", FICTIONAL)
    return await add_listing(session, name, category_slug=slug, **kwargs)


async def groups_of(client: AsyncClient, user: User) -> dict[str, dict]:
    response = await client.get("/staff/emergency-contacts", headers=bearer_for(user))
    assert response.status_code == 200, response.text
    return {group["category"]["slug"]: group for group in response.json()["groups"]}


async def test_an_editor_and_an_admin_may_read_it(
    client: AsyncClient, demo_users: dict[Role, User], categories: None, clock: None
) -> None:
    for role in (Role.editor, Role.admin):
        response = await client.get("/staff/emergency-contacts", headers=bearer_for(demo_users[role]))
        assert response.status_code == 200


@pytest.mark.parametrize("role", [Role.verifier, Role.provider])
async def test_a_verifier_and_a_provider_get_403(
    client: AsyncClient, demo_users: dict[Role, User], categories: None, clock: None, role: Role
) -> None:
    response = await client.get("/staff/emergency-contacts", headers=bearer_for(demo_users[role]))
    assert response.status_code == 403


async def test_without_a_token_it_is_401(client: AsyncClient, categories: None, clock: None) -> None:
    assert (await client.get("/staff/emergency-contacts")).status_code == 401


async def test_it_has_the_nine_groups_in_the_order_of_the_swiftrescue_page(
    client: AsyncClient, demo_users: dict[Role, User], categories: None, clock: None
) -> None:
    response = await client.get("/staff/emergency-contacts", headers=bearer_for(demo_users[Role.editor]))

    groups = response.json()["groups"]
    assert [(group["category"]["slug"], group["category"]["name"]) for group in groups] == list(GROUPS)
    assert len(groups) == 9
    assert all(group["contacts"] == [] and group["total"] == 0 for group in groups)


async def test_112_is_not_a_group_and_not_a_contact(
    client: AsyncClient, demo_users: dict[Role, User], categories: None, clock: None
) -> None:
    response = await client.get("/staff/emergency-contacts", headers=bearer_for(demo_users[Role.admin]))
    assert "112" not in response.text


async def test_contacts_of_every_status_are_listed_by_name_with_their_status_and_phone(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], categories: None, clock: None
) -> None:
    await contact(session, "Zeta Ambulance", status=ListingStatus.published)
    await contact(session, "Alpha Ambulance", status=ListingStatus.draft)
    await contact(session, "Mid Ambulance", status=ListingStatus.hidden)
    await contact(session, "Due Ambulance", status=ListingStatus.recheck_due)
    await session.commit()

    group = (await groups_of(client, demo_users[Role.editor]))["ambulance"]

    assert [(item["name"], item["status"]) for item in group["contacts"]] == [
        ("Alpha Ambulance", "draft"), ("Due Ambulance", "recheck_due"), ("Mid Ambulance", "hidden"),
        ("Zeta Ambulance", "published"),
    ]
    assert group["total"] == 4
    assert {item["primary_phone"] for item in group["contacts"]} == {FICTIONAL}


async def test_each_group_holds_only_its_own_category_and_other_categories_are_left_out(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], categories: None, clock: None
) -> None:
    await contact(session, "Fire One", "fire")
    await contact(session, "Police One", "police")
    await contact(session, "Night Pharmacy", "pharmacy")
    await session.commit()

    groups = await groups_of(client, demo_users[Role.editor])

    assert [item["name"] for item in groups["fire"]["contacts"]] == ["Fire One"]
    assert [item["name"] for item in groups["police"]["contacts"]] == ["Police One"]
    assert groups["ambulance"]["contacts"] == []
    every_name = {item["name"] for group in groups.values() for item in group["contacts"]}
    assert "Night Pharmacy" not in every_name


async def test_a_group_shows_at_most_100_contacts_and_total_is_the_real_number(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], categories: None, clock: None
) -> None:
    for number in range(103):
        await contact(session, f"Unit {number:03d}", "security", phone=f"+23400000{number:05d}")
    await session.commit()

    group = (await groups_of(client, demo_users[Role.editor]))["security"]

    assert len(group["contacts"]) == 100
    assert group["total"] == 103


async def test_a_draft_or_hidden_contact_is_not_in_the_public_swiftrescue_list(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], categories: None, clock: None
) -> None:
    await contact(session, "Public Ambulance", status=ListingStatus.published)
    await contact(session, "Draft Ambulance", status=ListingStatus.draft)
    await contact(session, "Hidden Ambulance", status=ListingStatus.hidden)
    await session.commit()

    public = (await client.get("/emergency")).text
    staff = (await client.get("/staff/emergency-contacts", headers=bearer_for(demo_users[Role.editor]))).text

    assert "Public Ambulance" in public
    assert "Draft Ambulance" not in public and "Hidden Ambulance" not in public
    assert "Draft Ambulance" in staff and "Hidden Ambulance" in staff


async def test_removing_a_contact_hides_it_and_deletes_nothing(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], categories: None, clock: None
) -> None:
    unit = await contact(session, "Old Ambulance", status=ListingStatus.published)
    await session.commit()
    editor = demo_users[Role.editor]
    assert "Old Ambulance" in (await client.get("/emergency")).text

    removed = await client.post(
        f"/listings/{unit.id}/hide", json={"reason": "No longer runs"}, headers=bearer_for(editor)
    )

    assert removed.status_code == 200, removed.text
    assert "Old Ambulance" not in (await client.get("/emergency")).text  # gone from SwiftRescue
    group = (await groups_of(client, editor))["ambulance"]
    assert [(item["name"], item["status"]) for item in group["contacts"]] == [("Old Ambulance", "hidden")]
    assert len((await session.exec(select(Listing))).all()) == 1  # nothing was deleted
    [entry] = (await session.exec(select(AuditEntry).where(AuditEntry.action == "hide"))).all()
    assert (entry.user_id, entry.reference) == (editor.id, "No longer runs")


async def test_a_new_contact_is_a_draft_until_it_is_verified_and_published(
    client: AsyncClient, demo_users: dict[Role, User], categories: None, clock: None
) -> None:
    editor = demo_users[Role.editor]
    body = {
        "name": "New Rescue Unit", "category": "ambulance", "area": "GRA", "address": "3 Example Road",
        "latitude": 6.45, "longitude": 7.5,
        "phones": [{"number": "08030000777", "is_primary": True}],  # a made-up number
    }

    created = await client.post("/listings", json=body, headers=bearer_for(editor))

    assert created.status_code == 201, created.text
    assert created.json()["status"] == "draft"
    assert "New Rescue Unit" not in (await client.get("/emergency")).text
    group = (await groups_of(client, editor))["ambulance"]
    assert [(item["name"], item["status"]) for item in group["contacts"]] == [("New Rescue Unit", "draft")]


async def test_it_sends_no_sponsored_flag_true_and_no_featured_field(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], categories: None, clock: None
) -> None:
    await contact(session, "Paid Ambulance", featured_until=NOW + timedelta(days=5))
    await session.commit()

    group = (await groups_of(client, demo_users[Role.editor]))["ambulance"]

    assert [item["sponsored"] for item in group["contacts"]] == [False]
    assert "featured" not in str(group)

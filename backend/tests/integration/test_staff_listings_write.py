"""POST /listings and PATCH /listings/{id}. Requirements: FR-31, FR-38, FR-42, NFR-06.
Contract: specs/backend/api-spec.md, section 5 and "Phase 10 clarifications". Decisions C1 and C3 in
specs/2026-10-20-staff-screens/requirements.md.
"""

from collections.abc import Iterator
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment
from app.main import app
from app.models import AuditEntry, Listing, OpeningHours, PhoneNumber, Service, User
from app.models.base import ListingStatus, Role
from tests.factories import add_listing
from tests.staff_helpers import bearer_for, listing_body

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 10, 6, 9, 0, tzinfo=timezone.utc)
STAFF_ROLES = [Role.verifier, Role.editor, Role.admin]


@pytest.fixture
def clock() -> Iterator[None]:
    app.dependency_overrides[get_current_moment] = lambda: NOW
    yield
    app.dependency_overrides.pop(get_current_moment, None)


@pytest.fixture
async def pharmacy_category(session: AsyncSession) -> None:
    from tests.factories import get_or_add_category

    await get_or_add_category(session, "pharmacy", "Pharmacy")
    await session.commit()


async def create(client: AsyncClient, user: User, **changes: object):
    return await client.post("/listings", json=listing_body(**changes), headers=bearer_for(user))


async def audit_rows(session: AsyncSession) -> list[AuditEntry]:
    return list((await session.exec(select(AuditEntry).order_by(AuditEntry.id))).all())


# --- create ---


async def test_creating_needs_a_login_and_a_staff_role(
    client: AsyncClient, demo_users: dict[Role, User], clock: None, pharmacy_category: None
) -> None:
    assert (await client.post("/listings", json=listing_body())).status_code == 401
    assert (await create(client, demo_users[Role.provider])).status_code == 403


@pytest.mark.parametrize("role", STAFF_ROLES)
async def test_every_staff_role_creates_a_draft_they_own(
    client: AsyncClient,
    session: AsyncSession,
    demo_users: dict[Role, User],
    clock: None,
    pharmacy_category: None,
    role: Role,
) -> None:
    response = await create(client, demo_users[role])
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["status"] == "draft"
    assert body["created_by"] == demo_users[role].id
    assert body["owner_id"] is None
    assert body["name"] == "Night Pharmacy A"
    assert body["slug"] == "night-pharmacy-a-new-haven"
    assert body["phones"] == [
        {"number": "+2348030000000", "label": "Front desk", "is_primary": True, "is_whatsapp": False}
    ]
    assert body["services"][0]["fee_min_naira"] == "1500.00"
    assert body["opening_hours"][0] == {
        "day_of_week": 0,
        "opens_at": "20:00",
        "closes_at": "02:00",
        "is_closed": False,
    }
    assert body["map_pin_is_default"] is False
    listing = await session.get(Listing, body["id"])
    assert listing.status == ListingStatus.draft


async def test_a_new_draft_is_not_public(
    client: AsyncClient, demo_users: dict[Role, User], clock: None, pharmacy_category: None
) -> None:
    body = (await create(client, demo_users[Role.verifier])).json()
    assert (await client.get(f"/listings/{body['slug']}")).status_code == 404
    assert (await client.get("/search")).json()["total"] == 0


async def test_the_slug_gets_a_number_when_it_is_taken(
    client: AsyncClient, demo_users: dict[Role, User], clock: None, pharmacy_category: None
) -> None:
    slugs = [(await create(client, demo_users[Role.editor])).json()["slug"] for _ in range(3)]
    assert slugs == [
        "night-pharmacy-a-new-haven",
        "night-pharmacy-a-new-haven-2",
        "night-pharmacy-a-new-haven-3",
    ]


async def test_creating_writes_one_create_audit_entry_with_the_caller(
    client: AsyncClient,
    session: AsyncSession,
    demo_users: dict[Role, User],
    clock: None,
    pharmacy_category: None,
) -> None:
    body = (await create(client, demo_users[Role.verifier])).json()
    [entry] = await audit_rows(session)
    assert (entry.user_id, entry.listing_id, entry.action) == (
        demo_users[Role.verifier].id,
        body["id"],
        "create",
    )


async def test_the_stored_rows_are_what_was_sent(
    client: AsyncClient,
    session: AsyncSession,
    demo_users: dict[Role, User],
    clock: None,
    pharmacy_category: None,
) -> None:
    body = (await create(client, demo_users[Role.verifier])).json()
    phones = (await session.exec(select(PhoneNumber).where(PhoneNumber.listing_id == body["id"]))).all()
    hours = (await session.exec(select(OpeningHours).where(OpeningHours.listing_id == body["id"]))).all()
    services = (await session.exec(select(Service).where(Service.listing_id == body["id"]))).all()
    assert [(p.number, p.is_primary) for p in phones] == [("+2348030000000", True)]
    assert [(h.day_of_week, h.opens_at.strftime("%H:%M"), h.closes_at.strftime("%H:%M")) for h in hours] == [
        (0, "20:00", "02:00")
    ]
    assert [(s.name, str(s.fee_min_naira), str(s.fee_max_naira)) for s in services] == [
        ("Malaria test", "1500.00", "3000.00")
    ]


async def test_a_service_name_is_stored_in_the_catalogue_spelling(
    client: AsyncClient, demo_users: dict[Role, User], clock: None, session: AsyncSession
) -> None:
    from tests.factories import get_or_add_category

    await get_or_add_category(session, "clinic", "Clinic")
    await session.commit()
    services = [{"name": " x-RAY "}, {"name": "O+"}]
    body = (await create(client, demo_users[Role.verifier], category="clinic", services=services)).json()
    assert sorted(service["name"] for service in body["services"]) == ["O+", "X-ray"]


@pytest.mark.parametrize(
    "changes",
    [
        {"category": "no-such-category"},
        {"area": "Atlantis"},
        {"name": "A"},
        {"name": "x" * 121},
        {"address": "ab"},
        {"latitude": 91},
        {"longitude": -181},
        {"phones": []},
        {"phones": [{"number": "08030000000", "is_primary": False}]},
        {
            "phones": [
                {"number": "08030000000", "is_primary": True},
                {"number": "08030000001", "is_primary": True},
            ]
        },
        {"phones": [{"number": "12345", "is_primary": True}]},
        {"services": [{"name": "Magic cure"}]},
        {"services": [{"name": "X-ray"}, {"name": "xray"}]},
        {"services": [{"name": "X-ray", "fee_min_naira": "5000.00", "fee_max_naira": "100.00"}]},
        {"services": [{"name": "X-ray", "fee_min_naira": "-1.00"}]},
        {"services": [{"name": "X-ray", "fee_min_naira": "10.005"}]},
        {"opening_hours": [{"day_of_week": 7, "opens_at": "08:00", "closes_at": "17:00"}]},
        {"opening_hours": [{"day_of_week": 1, "opens_at": "08:00"}]},
        {"opening_hours": [{"day_of_week": 1, "opens_at": "08:00", "closes_at": "17:00"}] * 2},
        {"description": "x" * 1001},
    ],
)
async def test_bad_input_is_422_and_nothing_is_stored(
    client: AsyncClient,
    session: AsyncSession,
    demo_users: dict[Role, User],
    clock: None,
    pharmacy_category: None,
    changes: dict,
) -> None:
    response = await create(client, demo_users[Role.verifier], **changes)
    assert response.status_code == 422, response.text
    assert (await session.exec(select(Listing))).all() == []
    assert await audit_rows(session) == []


async def test_a_closed_day_needs_no_times_and_is_returned_closed(
    client: AsyncClient, demo_users: dict[Role, User], clock: None, pharmacy_category: None
) -> None:
    hours = [{"day_of_week": 6, "is_closed": True, "opens_at": "08:00", "closes_at": "09:00"}]
    body = (await create(client, demo_users[Role.verifier], opening_hours=hours)).json()
    assert body["opening_hours"][6] == {
        "day_of_week": 6,
        "opens_at": None,
        "closes_at": None,
        "is_closed": True,
    }


async def test_an_unknown_category_message_names_the_field(
    client: AsyncClient, demo_users: dict[Role, User], clock: None, pharmacy_category: None
) -> None:
    response = await create(client, demo_users[Role.verifier], category="no-such-category")
    assert response.status_code == 422
    assert "category" in str(response.json()["detail"])


# --- edit ---


async def a_draft(session: AsyncSession, creator: User, **fields: object) -> Listing:
    listing = await add_listing(session, "Old Name", status=ListingStatus.draft, **fields)
    listing.created_by = creator.id
    session.add(listing)
    await session.commit()
    return listing


async def patch(client: AsyncClient, user: User, listing: Listing, **body: object):
    return await client.patch(f"/listings/{listing.id}", json=body, headers=bearer_for(user))


async def test_a_verifier_edits_their_own_draft(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    verifier = demo_users[Role.verifier]
    listing = await a_draft(session, verifier)
    response = await patch(client, verifier, listing, name="New Name", landmark="By the church")
    assert response.status_code == 200, response.text
    assert response.json()["name"] == "New Name"
    assert response.json()["landmark"] == "By the church"
    await session.refresh(listing)
    assert listing.name == "New Name"


async def test_a_verifier_cannot_edit_another_verifiers_draft_or_a_published_listing(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    verifier, editor = demo_users[Role.verifier], demo_users[Role.editor]
    others = await a_draft(session, editor)
    assert (await patch(client, verifier, others, name="Hijack")).status_code == 403
    mine_published = await add_listing(session, "Published")
    mine_published.created_by = verifier.id
    session.add(mine_published)
    await session.commit()
    assert (await patch(client, verifier, mine_published, name="Changed")).status_code == 403
    await session.refresh(others)
    assert others.name == "Old Name"


@pytest.mark.parametrize("role", [Role.editor, Role.admin])
async def test_an_editor_or_admin_edits_any_listing(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None, role: Role
) -> None:
    listing = await add_listing(session, "Published")
    await session.commit()
    assert (await patch(client, demo_users[role], listing, address="1 New Road")).status_code == 200


async def test_a_provider_cannot_use_this_endpoint_even_for_their_own_listing(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    provider = demo_users[Role.provider]
    listing = await add_listing(session, "Mine")
    listing.owner_id = provider.id
    session.add(listing)
    await session.commit()
    assert (await patch(client, provider, listing, name="Changed")).status_code == 403


async def test_patching_an_unknown_listing_is_404_and_without_a_login_401(
    client: AsyncClient, demo_users: dict[Role, User], clock: None
) -> None:
    assert (
        await client.patch(
            "/listings/99999", json={"name": "Abc"}, headers=bearer_for(demo_users[Role.editor])
        )
    ).status_code == 404
    assert (await client.patch("/listings/1", json={"name": "Abc"})).status_code == 401


async def test_a_field_that_is_not_sent_is_left_alone_and_a_null_description_clears_it(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    editor = demo_users[Role.editor]
    listing = await a_draft(session, editor)
    listing.description = "Old text"
    session.add(listing)
    await session.commit()
    await patch(client, editor, listing, name="Changed Name")
    await session.refresh(listing)
    assert listing.description == "Old text"
    await patch(client, editor, listing, description=None)
    await session.refresh(listing)
    assert listing.description is None


async def test_required_fields_cannot_be_set_to_null(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    editor = demo_users[Role.editor]
    listing = await a_draft(session, editor)
    for field in ("name", "category", "area", "address", "latitude", "longitude", "is_24_hours", "phones"):
        assert (await patch(client, editor, listing, **{field: None})).status_code == 422, field


async def test_editing_writes_one_audit_entry_per_changed_field_with_old_and_new(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    verifier = demo_users[Role.verifier]
    listing = await a_draft(session, verifier)
    await patch(
        client, verifier, listing, name="New Name", address="1 Example Road", landmark="By the church"
    )
    entries = await audit_rows(session)
    changed = {entry.field_changed: (entry.old_value, entry.new_value) for entry in entries}
    assert changed == {
        "name": ("Old Name", "New Name"),
        "landmark": (None, "By the church"),
    }  # the address is the same as before ("1 Example Road"), so it writes nothing
    assert {entry.user_id for entry in entries} == {verifier.id}
    assert {entry.action for entry in entries} == {"update"}


async def test_a_change_to_the_same_value_writes_nothing(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    editor = demo_users[Role.editor]
    listing = await a_draft(session, editor)
    response = await patch(client, editor, listing, name="Old Name", is_24_hours=False)
    assert response.status_code == 200
    assert await audit_rows(session) == []


async def test_a_category_change_is_by_slug_and_audited(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    from tests.factories import get_or_add_category

    editor = demo_users[Role.editor]
    listing = await a_draft(session, editor)
    await get_or_add_category(session, "clinic", "Clinic")
    await session.commit()
    response = await patch(client, editor, listing, category="clinic")
    assert response.status_code == 200
    assert response.json()["category"]["slug"] == "clinic"
    [entry] = await audit_rows(session)
    assert (entry.field_changed, entry.old_value, entry.new_value) == ("category", "pharmacy", "clinic")
    assert (await patch(client, editor, listing, category="nope")).status_code == 422


async def test_lists_replace_the_old_rows_and_each_changed_list_is_audited_once(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    editor = demo_users[Role.editor]
    listing = await a_draft(session, editor, service_names=("Consultation",))
    new_phones = [
        {"number": "0803 111 2222", "label": "Front desk", "is_primary": True, "is_whatsapp": True},
        {"number": "08031112223", "is_primary": False},
    ]
    new_hours = [{"day_of_week": d, "opens_at": "08:00", "closes_at": "18:00"} for d in range(5)]
    response = await patch(
        client, editor, listing, phones=new_phones, opening_hours=new_hours, services=[{"name": "X-ray"}]
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert [phone["number"] for phone in body["phones"]] == ["+2348031112222", "+2348031112223"]
    assert body["phones"][0]["is_whatsapp"] is True
    assert [service["name"] for service in body["services"]] == ["X-ray"]
    assert [day["is_closed"] for day in body["opening_hours"]] == [False] * 5 + [True, True]
    phones = (await session.exec(select(PhoneNumber).where(PhoneNumber.listing_id == listing.id))).all()
    assert len(phones) == 2  # the old row is gone
    changed = [entry.field_changed for entry in await audit_rows(session)]
    assert sorted(changed) == ["opening_hours", "phones", "services"]


async def test_sending_the_same_list_again_writes_nothing(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    editor = demo_users[Role.editor]
    listing = await a_draft(session, editor, phone="+2348031112222")
    response = await patch(client, editor, listing, phones=[{"number": "08031112222", "is_primary": True}])
    assert response.status_code == 200
    assert await audit_rows(session) == []


async def test_an_edit_sets_updated_at(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    editor = demo_users[Role.editor]
    listing = await a_draft(session, editor)
    await patch(client, editor, listing, name="Changed Name")
    await session.refresh(listing)
    assert listing.updated_at == NOW


async def test_the_audit_entry_of_an_edit_holds_no_password_and_no_token(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    editor = demo_users[Role.editor]
    listing = await a_draft(session, editor)
    await patch(client, editor, listing, name="Changed Name")
    text = " ".join(str(v) for entry in await audit_rows(session) for v in entry.model_dump().values())
    assert editor.password_hash not in text

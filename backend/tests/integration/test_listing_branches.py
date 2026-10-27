"""Branches of a facility. Requirements: FR-52, US-20, FR-50, NFR-06. Spec: specs/backend/api-spec.md
section 7, "Phase 8b"; decision D5 of specs/2026-10-23-accounts-and-facility-ownership/.

A branch is a listing of its own that points to a main facility (`parent_id`), one level only. The owner
of the main facility may work on its branches (access inherits, one way); a branch is verified and
published on its own.
Every name, address and number here is fictional.
"""

from collections.abc import Iterator
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment
from app.core.config import DEFAULT_MAP_CENTRE
from app.main import app
from app.models import AuditEntry, FacilityOwner, Listing, PhoneNumber, User, VerificationCheck
from app.models.base import CheckMethod, CheckResult, ListingStatus, Role
from app.repositories import user_repository
from tests.factories import add_listing, add_owner_link, get_or_add_category
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 10, 27, 9, 0, tzinfo=timezone.utc)
BRANCH_BODY = {
    "facility_name": "Eze Clinic Ogui Branch",
    "area": "Ogui",
    "address": "7 Branch Road",
    "phone": "08030009999",
}
MAIN_PHONE = "+2348030001111"
ALREADY = "This branch is already registered. Please contact us."


@pytest.fixture
def clock() -> Iterator[None]:
    app.dependency_overrides[get_current_moment] = lambda: NOW
    yield
    app.dependency_overrides.pop(get_current_moment, None)


@pytest.fixture
async def main(session: AsyncSession) -> Listing:
    listing = await add_listing(
        session, "Eze Clinic", category_slug="clinic", area="GRA", phone=MAIN_PHONE,
    )
    await session.commit()
    return listing


@pytest.fixture
def owner(demo_users: dict[Role, User]) -> User:
    return demo_users[Role.provider]


async def a_branch(session: AsyncSession, main: Listing, name: str = "Eze Clinic Annex", **kwargs):
    kwargs.setdefault("category_slug", "clinic")
    kwargs.setdefault("phone", "+2348030002222")
    branch = await add_listing(session, name, parent_id=main.id, **kwargs)
    await session.commit()
    return branch


async def create_branch(
    client: AsyncClient, user: User | None, parent_id: int, ip: str = "203.0.113.5", **changes: object
):
    return await client.post(
        f"/provider/facilities/{parent_id}/branches",
        json={**BRANCH_BODY, **changes},
        headers={**(bearer_for(user) if user else {}), "x-forwarded-for": ip},
    )


async def close_listing(client: AsyncClient, headers: dict[str, str], listing_id: int):
    return await client.post(f"/listings/{listing_id}/close", json={"reason": "Closed down"}, headers=headers)


async def set_parent(client: AsyncClient, user: User, listing_id: int, parent_id: int | None):
    return await client.patch(
        f"/listings/{listing_id}", json={"parent_id": parent_id}, headers=bearer_for(user)
    )


async def other_provider(session: AsyncSession, password_hash: str) -> User:
    provider = await user_repository.create(
        session, name="Other Provider", email="other@example.com", phone="+2348030000199",
        password_hash=password_hash, role=Role.provider,
    )
    await session.commit()
    return provider


# ---------- creating a branch ----------


async def test_an_owner_of_the_main_facility_creates_a_draft_branch_with_its_category(
    client: AsyncClient, session: AsyncSession, owner: User, main: Listing, clock: None
) -> None:
    await add_owner_link(session, main, owner)
    await session.commit()

    response = await create_branch(client, owner, main.id)

    assert response.status_code == 201, response.text
    [branch] = (await session.exec(select(Listing).where(Listing.parent_id == main.id))).all()
    assert response.json() == {
        "message": "Thanks. Our team will verify the branch before it is listed.", "listing_id": branch.id,
    }
    assert (branch.name, branch.area, branch.address) == ("Eze Clinic Ogui Branch", "Ogui", "7 Branch Road")
    assert (branch.status, branch.category_id, branch.created_by, branch.owner_id) == (
        ListingStatus.draft, main.category_id, None, None,
    )
    assert (branch.latitude, branch.longitude) == DEFAULT_MAP_CENTRE
    [phone] = (await session.exec(select(PhoneNumber).where(PhoneNumber.listing_id == branch.id))).all()
    assert (phone.number, phone.is_primary) == ("+2348030009999", True)


async def test_a_branch_has_no_owner_link_of_its_own_and_the_audit_row_names_the_main_facility(
    client: AsyncClient, session: AsyncSession, owner: User, main: Listing, clock: None
) -> None:
    await add_owner_link(session, main, owner)
    await session.commit()
    await create_branch(client, owner, main.id)

    links = (await session.exec(select(FacilityOwner))).all()
    assert [link.listing_id for link in links] == [main.id]
    [entry] = (await session.exec(select(AuditEntry).where(AuditEntry.action == "create"))).all()
    assert (entry.user_id, entry.reference, entry.changed_at) == (owner.id, f"branch-of:{main.id}", NOW)


async def test_a_manager_may_create_a_branch_too(
    client: AsyncClient, session: AsyncSession, owner: User, main: Listing, clock: None
) -> None:
    await add_owner_link(session, main, owner, role="manager")
    await session.commit()
    assert (await create_branch(client, owner, main.id)).status_code == 201


@pytest.mark.parametrize("state", ["pending", "removed", "none"])
async def test_a_provider_without_an_approved_link_on_the_main_facility_gets_404(
    client: AsyncClient, session: AsyncSession, owner: User, main: Listing, clock: None, state: str
) -> None:
    if state != "none":
        await add_owner_link(session, main, owner, status=state)
        await session.commit()
    assert (await create_branch(client, owner, main.id)).status_code == 404
    assert (await client.get(
        f"/provider/facilities/{main.id}/branches", headers=bearer_for(owner)
    )).status_code == 404
    assert (await session.exec(select(Listing).where(Listing.parent_id == main.id))).all() == []


async def test_anonymous_is_401_and_staff_is_403(
    client: AsyncClient, demo_users: dict[Role, User], main: Listing, clock: None
) -> None:
    assert (await create_branch(client, None, main.id)).status_code == 401
    for role in (Role.verifier, Role.editor, Role.admin):
        assert (await create_branch(client, demo_users[role], main.id)).status_code == 403


async def test_a_link_on_a_branch_does_not_let_its_owner_create_a_branch_of_a_branch(
    client: AsyncClient, session: AsyncSession, owner: User, main: Listing, clock: None
) -> None:
    branch = await a_branch(session, main)
    await add_owner_link(session, branch, owner)
    await session.commit()

    response = await create_branch(client, owner, branch.id)

    assert response.status_code == 422
    assert response.json()["detail"] == "A branch cannot have its own branches."


async def test_the_owner_of_the_main_facility_cannot_create_a_branch_of_a_branch_either(
    client: AsyncClient, session: AsyncSession, owner: User, main: Listing, clock: None
) -> None:
    branch = await a_branch(session, main)
    await add_owner_link(session, main, owner)
    await session.commit()

    response = await create_branch(client, owner, branch.id)

    assert response.status_code == 422
    assert response.json()["detail"] == "A branch cannot have its own branches."


async def test_a_closed_main_facility_cannot_get_a_branch(
    client: AsyncClient, session: AsyncSession, owner: User, main: Listing, clock: None
) -> None:
    await add_owner_link(session, main, owner)
    main.closed_at = NOW
    session.add(main)
    await session.commit()

    response = await create_branch(client, owner, main.id)

    assert response.status_code == 422
    assert response.json()["detail"] == "A closed facility cannot have branches."


@pytest.mark.parametrize(
    "changes",
    [
        {"facility_name": "A"}, {"facility_name": "x" * 121}, {"area": "Atlantis"}, {"address": "ab"},
        {"phone": ""}, {"phone": "12345"}, {"notes": "x" * 301}, {"category": "pharmacy"},
    ],
)
async def test_bad_input_is_422_and_nothing_is_stored(
    client: AsyncClient, session: AsyncSession, owner: User, main: Listing, clock: None, changes: dict
) -> None:
    await add_owner_link(session, main, owner)
    await session.commit()
    response = await create_branch(client, owner, main.id, **changes)
    assert response.status_code == 422, response.text
    assert (await session.exec(select(Listing).where(Listing.parent_id == main.id))).all() == []


async def test_the_eleventh_branch_from_one_address_in_a_day_is_429(
    client: AsyncClient, session: AsyncSession, owner: User, main: Listing, clock: None
) -> None:
    await add_owner_link(session, main, owner)
    await session.commit()
    for number in range(10):
        response = await create_branch(
            client, owner, main.id, facility_name=f"Branch {number}", address=f"{number + 20} Other Road",
            phone=f"0803000200{number}",
        )
        assert response.status_code == 201, response.text
    response = await create_branch(
        client, owner, main.id, facility_name="Branch 11", address="99 Last Road", phone="08030002099"
    )
    assert response.status_code == 429


# ---------- the duplicate check inside one facility ----------


async def test_the_phone_of_the_main_facility_is_a_duplicate(
    client: AsyncClient, session: AsyncSession, owner: User, main: Listing, clock: None
) -> None:
    await add_owner_link(session, main, owner)
    await session.commit()
    response = await create_branch(client, owner, main.id, phone="0803 000 1111")
    assert response.status_code == 409
    assert response.json()["detail"] == ALREADY
    assert (await session.exec(select(Listing).where(Listing.parent_id == main.id))).all() == []


async def test_the_phone_or_address_of_a_sibling_is_a_duplicate(
    client: AsyncClient, session: AsyncSession, owner: User, main: Listing, clock: None
) -> None:
    await add_owner_link(session, main, owner)
    sibling = await a_branch(session, main, phone="+2348030009999")
    sibling.address = "7 Branch Road"
    session.add(sibling)
    await session.commit()

    same_phone = await create_branch(client, owner, main.id, address="1 Somewhere Else", phone="08030009999")
    same_address = await create_branch(
        client, owner, main.id, phone="08030004444", address="  7 BRANCH road "
    )

    assert (same_phone.status_code, same_address.status_code) == (409, 409)


async def test_the_address_of_the_main_facility_is_a_duplicate(
    client: AsyncClient, session: AsyncSession, owner: User, main: Listing, clock: None
) -> None:
    await add_owner_link(session, main, owner)
    await session.commit()
    response = await create_branch(client, owner, main.id, address="1 Example Road", phone="08030004444")
    assert response.status_code == 409


async def test_nothing_outside_the_facility_is_compared(
    client: AsyncClient, session: AsyncSession, owner: User, main: Listing, clock: None
) -> None:
    await add_owner_link(session, main, owner)
    await add_listing(
        session, "Unrelated Pharmacy", category_slug="pharmacy", phone="+2348030009999",
    )
    await session.commit()
    # the same phone as an unrelated facility, and a name like the main one: only phone and address inside
    # this facility are compared
    response = await create_branch(client, owner, main.id, facility_name="Eze Clinic")
    assert response.status_code == 201, response.text


# ---------- listing the branches ----------


async def test_the_owner_lists_the_branches_of_any_status(
    client: AsyncClient, session: AsyncSession, owner: User, main: Listing, clock: None
) -> None:
    await add_owner_link(session, main, owner)
    published = await a_branch(session, main, "Branch A", phone="+2348030003331")
    draft = await a_branch(session, main, "Branch B", status=ListingStatus.draft, phone="+2348030003332")
    await add_listing(session, "Not A Branch", category_slug="clinic", phone="+2348030003333")
    await session.commit()

    response = await client.get(f"/provider/facilities/{main.id}/branches", headers=bearer_for(owner))

    assert response.status_code == 200
    assert response.json()["items"] == [
        {"id": published.id, "name": "Branch A", "area": "GRA", "status": "published"},
        {"id": draft.id, "name": "Branch B", "area": "GRA", "status": "draft"},
    ]


# ---------- setting and clearing the parent (staff) ----------


async def test_an_editor_makes_a_listing_a_branch_and_it_is_audited(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], main: Listing, clock: None
) -> None:
    other = await add_listing(session, "Eze Clinic Two", category_slug="clinic", phone="+2348030005555")
    await session.commit()
    editor = demo_users[Role.editor]

    response = await set_parent(client, editor, other.id, main.id)

    assert response.status_code == 200, response.text
    assert (response.json()["parent_id"], response.json()["parent_name"]) == (main.id, "Eze Clinic")
    [entry] = (await session.exec(select(AuditEntry).where(AuditEntry.field_changed == "parent_id"))).all()
    assert (entry.action, entry.old_value, entry.new_value, entry.user_id) == (
        "update", None, str(main.id), editor.id,
    )


async def test_an_editor_clears_the_parent(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], main: Listing, clock: None
) -> None:
    branch = await a_branch(session, main)

    response = await set_parent(client, demo_users[Role.admin], branch.id, None)

    assert response.status_code == 200, response.text
    assert (response.json()["parent_id"], response.json()["parent_name"]) == (None, None)
    [entry] = (await session.exec(select(AuditEntry).where(AuditEntry.field_changed == "parent_id"))).all()
    assert (entry.old_value, entry.new_value) == (str(main.id), None)


async def test_a_verifier_cannot_set_the_parent_even_on_their_own_draft(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], main: Listing, clock: None
) -> None:
    verifier = demo_users[Role.verifier]
    draft = await add_listing(session, "Draft Clinic", category_slug="clinic", status=ListingStatus.draft,
                              phone="+2348030006666")
    draft.created_by = verifier.id
    session.add(draft)
    await session.commit()

    assert (await set_parent(client, verifier, draft.id, main.id)).status_code == 403
    assert (await client.patch(
        f"/listings/{draft.id}", json={"description": "Fine"}, headers=bearer_for(verifier)
    )).status_code == 200


async def test_a_provider_cannot_send_parent_id(
    client: AsyncClient, session: AsyncSession, owner: User, main: Listing, clock: None
) -> None:
    await add_owner_link(session, main, owner)
    await session.commit()
    response = await client.patch(
        f"/provider/listings/{main.id}", json={"parent_id": main.id}, headers=bearer_for(owner)
    )
    assert response.status_code == 422


@pytest.mark.parametrize(
    ("make_case", "sentence"),
    [
        ("itself", "A facility cannot be its own parent."),
        ("missing", "No such main facility."),
        ("parent_is_a_branch", "A branch cannot have its own branches."),
        ("has_branches", "This listing has branches, so it cannot be a branch."),
        ("parent_closed", "A closed facility cannot have branches."),
        ("other_category", "A branch must be the same kind of facility as its main facility."),
    ],
)
async def test_the_rules_refuse_with_their_own_sentence_and_change_nothing(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], main: Listing, clock: None,
    make_case: str, sentence: str,
) -> None:
    editor = demo_users[Role.editor]
    child = await add_listing(session, "Candidate", category_slug="clinic", phone="+2348030007777")
    target_id = main.id
    if make_case == "itself":
        target_id = child.id
    elif make_case == "missing":
        target_id = 999999
    elif make_case == "parent_is_a_branch":
        target_id = (await a_branch(session, main)).id
    elif make_case == "has_branches":
        await a_branch(session, child, "Child Annex", phone="+2348030007778")
    elif make_case == "parent_closed":
        main.closed_at = NOW
        session.add(main)
    elif make_case == "other_category":
        await get_or_add_category(session, "pharmacy")
        pharmacy = await add_listing(
            session, "Main Pharmacy", category_slug="pharmacy", phone="+2348030007779"
        )
        target_id = pharmacy.id
    await session.commit()

    response = await set_parent(client, editor, child.id, target_id)

    assert response.status_code == 422, response.text
    assert response.json()["detail"] == sentence
    await session.refresh(child)
    assert child.parent_id is None


async def test_setting_the_same_parent_again_writes_nothing(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], main: Listing, clock: None
) -> None:
    branch = await a_branch(session, main)
    await set_parent(client, demo_users[Role.editor], branch.id, main.id)
    assert (await session.exec(select(AuditEntry).where(AuditEntry.field_changed == "parent_id"))).all() == []


# ---------- access inherits, one way ----------


async def test_the_owner_of_the_main_facility_can_read_edit_move_close_and_see_the_history_of_a_branch(
    client: AsyncClient, session: AsyncSession, owner: User, main: Listing, clock: None
) -> None:
    await add_owner_link(session, main, owner)
    branch = await a_branch(session, main)
    headers = bearer_for(owner)

    assert (await client.get(f"/provider/listings/{branch.id}", headers=headers)).status_code == 200
    edit = await client.patch(
        f"/provider/listings/{branch.id}", json={"description": "Branch hours vary"}, headers=headers
    )
    assert edit.status_code == 200, edit.text
    moved = await client.post(
        f"/listings/{branch.id}/move", json={"address": "5 Newer Road", "area": "Ogui"}, headers=headers
    )
    assert moved.status_code == 200, moved.text
    assert (await client.get(f"/listings/{branch.id}/address-history", headers=headers)).status_code == 200
    closed = await close_listing(client, headers, branch.id)
    assert closed.status_code == 200, closed.text


async def test_a_manager_of_the_main_facility_gets_a_managers_rights_on_the_branch(
    client: AsyncClient, session: AsyncSession, owner: User, main: Listing, clock: None
) -> None:
    await add_owner_link(session, main, owner, role="manager")
    branch = await a_branch(session, main)
    headers = bearer_for(owner)

    assert (await client.get(f"/provider/listings/{branch.id}", headers=headers)).status_code == 200
    closed = await close_listing(client, headers, branch.id)
    assert closed.status_code == 403  # only an owner may close


async def test_a_link_on_a_branch_gives_nothing_on_the_main_facility(
    client: AsyncClient, session: AsyncSession, owner: User, main: Listing, clock: None
) -> None:
    branch = await a_branch(session, main)
    await add_owner_link(session, branch, owner)
    await session.commit()
    headers = bearer_for(owner)

    assert (await client.get(f"/provider/listings/{branch.id}", headers=headers)).status_code == 200
    assert (await client.get(f"/provider/listings/{main.id}", headers=headers)).status_code == 404
    moved = await client.post(
        f"/listings/{main.id}/move", json={"address": "5 Newer Road", "area": "Ogui"}, headers=headers
    )
    assert moved.status_code == 403
    assert (await client.get(f"/listings/{main.id}/address-history", headers=headers)).status_code == 403


@pytest.mark.parametrize("state", ["pending", "removed"])
async def test_a_pending_or_removed_link_on_the_main_facility_gives_nothing_on_the_branch(
    client: AsyncClient, session: AsyncSession, owner: User, main: Listing, clock: None, state: str
) -> None:
    await add_owner_link(session, main, owner, status=state)
    branch = await a_branch(session, main)
    headers = bearer_for(owner)

    assert (await client.get(f"/provider/listings/{branch.id}", headers=headers)).status_code == 404
    moved = await client.post(
        f"/listings/{branch.id}/move", json={"address": "5 Newer Road", "area": "Ogui"}, headers=headers
    )
    assert moved.status_code == 403


async def test_another_provider_gets_nothing_on_the_branch(
    client: AsyncClient, session: AsyncSession, owner: User, main: Listing, demo_password_hash: str,
    clock: None,
) -> None:
    await add_owner_link(session, main, owner)
    branch = await a_branch(session, main)
    stranger = await other_provider(session, demo_password_hash)

    response = await client.get(f"/provider/listings/{branch.id}", headers=bearer_for(stranger))
    assert response.status_code == 404


async def test_the_persons_own_facility_stays_the_one_with_their_own_link(
    client: AsyncClient, session: AsyncSession, owner: User, main: Listing, clock: None
) -> None:
    """`/provider/listing` and paying for Featured use the person's OWN links only: a branch reached through
    its main facility is never "my facility" for them."""
    branch = await a_branch(session, main)
    await add_owner_link(session, branch, owner)  # the person's own link is on the branch...
    await add_owner_link(session, main, owner, role="manager")  # ...and a manager link on the main one
    await session.commit()

    first = await client.get("/provider/listing", headers=bearer_for(owner))

    assert first.json()["id"] == main.id  # the lowest listing id among their own links, as before
    listing_ids = [item["listing_id"] for item in (await client.get(
        "/provider/listings", headers=bearer_for(owner)
    )).json()["items"]]
    assert listing_ids == [main.id, branch.id]


# ---------- a branch is verified and published on its own ----------


async def test_publishing_the_main_facility_does_not_publish_its_branch(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    await get_or_add_category(session, "clinic")
    parent = await add_listing(
        session, "Main Clinic", category_slug="clinic", status=ListingStatus.pending_review,
        phone="+2348030008881",
    )
    branch = await add_listing(session, "Main Clinic Annex", category_slug="clinic",
                               status=ListingStatus.draft, phone="+2348030008882", parent_id=parent.id)
    await session.commit()
    editor = demo_users[Role.editor]
    session.add(VerificationCheck(
        listing_id=parent.id, staff_id=editor.id, method=CheckMethod.call, result=CheckResult.passed,
        checked_at=NOW - timedelta(days=1),
    ))
    await session.commit()

    published = await client.post(f"/listings/{parent.id}/publish", headers=bearer_for(editor))

    assert published.status_code == 200, published.text
    await session.refresh(branch)
    assert branch.status == ListingStatus.draft
    names = [item["name"] for item in (await client.get("/search")).json()["items"]]
    assert names == ["Main Clinic"]


# ---------- what the public sees ----------


async def test_search_and_the_listing_page_show_branch_of_when_the_main_facility_is_published(
    client: AsyncClient, session: AsyncSession, main: Listing, clock: None
) -> None:
    branch = await a_branch(session, main)

    results = (await client.get("/search")).json()["items"]
    by_name = {item["name"]: item for item in results}
    assert by_name["Eze Clinic Annex"]["branch_of"] == {"name": "Eze Clinic", "slug": main.slug}
    assert by_name["Eze Clinic"]["branch_of"] is None
    page = (await client.get(f"/listings/{branch.slug}")).json()
    assert page["branch_of"] == {"name": "Eze Clinic", "slug": main.slug}
    assert page["branches"] == []


async def test_the_main_page_lists_only_its_published_branches_by_name(
    client: AsyncClient, session: AsyncSession, main: Listing, clock: None
) -> None:
    await a_branch(session, main, "Zeta Annex", phone="+2348030003341")
    await a_branch(session, main, "Alpha Annex", phone="+2348030003342", area="Ogui")
    await a_branch(session, main, "Draft Annex", status=ListingStatus.draft, phone="+2348030003343")
    await a_branch(session, main, "Hidden Annex", status=ListingStatus.hidden, phone="+2348030003344")
    await a_branch(session, main, "Due Annex", status=ListingStatus.recheck_due, phone="+2348030003345")

    page = (await client.get(f"/listings/{main.slug}")).json()

    listed = [(item["name"], item["area"]) for item in page["branches"]]
    assert listed == [("Alpha Annex", "Ogui"), ("Zeta Annex", "GRA")]
    assert all(set(item) == {"name", "slug", "area"} for item in page["branches"])


@pytest.mark.parametrize("status", [ListingStatus.hidden, ListingStatus.recheck_due, ListingStatus.draft])
async def test_a_main_facility_that_is_not_published_is_never_named(
    client: AsyncClient, session: AsyncSession, main: Listing, clock: None, status: ListingStatus
) -> None:
    branch = await a_branch(session, main)
    main.status = status
    session.add(main)
    await session.commit()

    results = (await client.get("/search")).json()["items"]
    assert [item["branch_of"] for item in results if item["name"] == "Eze Clinic Annex"] == [None]
    assert (await client.get(f"/listings/{branch.slug}")).json()["branch_of"] is None
    page_text = (await client.get(f"/listings/{branch.slug}")).text
    assert "Eze Clinic" not in page_text.replace("Eze Clinic Annex", "")


async def test_the_staff_detail_names_the_main_facility(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], main: Listing, clock: None
) -> None:
    branch = await a_branch(session, main)
    editor = bearer_for(demo_users[Role.editor])
    detail = (await client.get(f"/listings/id/{branch.id}", headers=editor)).json()
    assert (detail["parent_id"], detail["parent_name"]) == (main.id, "Eze Clinic")
    plain = (await client.get(f"/listings/id/{main.id}", headers=editor)).json()
    assert (plain["parent_id"], plain["parent_name"]) == (None, None)


async def test_swiftrescue_and_the_blood_lists_do_not_fill_branch_of(
    client: AsyncClient, session: AsyncSession, clock: None
) -> None:
    ambulance = await get_or_add_category(session, "ambulance", "Ambulance")
    ambulance.is_emergency = True
    session.add(ambulance)
    main_unit = await add_listing(session, "Rescue Main", category_slug="ambulance", phone="+2348030004441")
    await add_listing(session, "Rescue Branch", category_slug="ambulance", phone="+2348030004442",
                      parent_id=main_unit.id)
    await session.commit()

    body = (await client.get("/emergency")).json()

    contacts = [contact for group in body["groups"] for contact in group["contacts"]]
    assert {contact["name"] for contact in contacts} >= {"Rescue Main", "Rescue Branch"}
    assert {contact["branch_of"] for contact in contacts} == {None}

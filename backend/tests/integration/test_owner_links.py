"""Owner links: which provider may edit or pay for which listing. Requirements: FR-50, FR-43, US-19, NFR-06.
Spec: specs/backend/api-spec.md section 7, "Phase 6a"; decisions D1, D4 and D5 of
specs/2026-10-23-accounts-and-facility-ownership/.

A provider reaches a listing only through an APPROVED row of `facility_owners`. A pending or removed link, or
none, is a 404 (so the existence of a listing is not revealed). A manager edits but does not pay. Editors and
admins approve, reject and remove links after phoning the facility, and write down who they reached. Every
name, address and number here is fictional.
"""

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import AuditEntry, FacilityOwner, User
from app.models.base import Role
from app.repositories import user_repository
from tests.conftest import DEMO_PASSWORD
from tests.factories import add_listing, add_owner_link
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio

CALL_NOTE = "Spoke to the matron, Mrs Eze, who confirmed."
NO_LISTING = "No listing is linked to your account."


async def new_provider(session: AsyncSession, number: int, password_hash: str) -> User:
    provider = await user_repository.create(
        session,
        name=f"Provider {number}",
        email=f"provider{number}@example.com",
        phone=f"+23480300001{number:02d}",
        password_hash=password_hash,
        role=Role.provider,
    )
    await session.commit()
    return provider


async def clinic(session: AsyncSession, name: str = "Eze Clinic", **kwargs: object):
    listing = await add_listing(session, name, category_slug="clinic", phone="+2340000000555", **kwargs)
    await session.commit()
    return listing


async def link(session: AsyncSession, listing, user: User, **kwargs: str) -> FacilityOwner:
    made = await add_owner_link(session, listing, user, **kwargs)
    await session.commit()
    return made


async def get_mine(client: AsyncClient, user: User | None, listing_id: int | None = None):
    path = "/provider/listing" if listing_id is None else f"/provider/listings/{listing_id}"
    return await client.get(path, headers=bearer_for(user) if user else {})


async def patch_mine(client: AsyncClient, user: User, listing_id: int, body: dict):
    return await client.patch(
        f"/provider/listings/{listing_id}", json=body, headers=bearer_for(user)
    )


async def pay_for_featured(client: AsyncClient, user: User):
    return await client.post(
        "/payments/featured", json={"plan": "monthly"}, headers=bearer_for(user)
    )


async def decide(client: AsyncClient, staff: User | None, link_id: int, action: str, body: dict | None):
    headers = bearer_for(staff) if staff else {}
    return await client.post(f"/staff/owner-requests/{link_id}/{action}", json=body, headers=headers)


async def audit(session: AsyncSession, action: str) -> list[AuditEntry]:
    query = select(AuditEntry).where(AuditEntry.action == action).order_by(AuditEntry.id)  # type: ignore[arg-type]
    return list((await session.exec(query)).all())


# --- what a link allows ---


async def test_a_provider_with_an_approved_link_reads_and_edits_the_listing(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    provider = demo_users[Role.provider]
    listing = await clinic(session)
    await link(session, listing, provider)

    read = await get_mine(client, provider, listing.id)
    edit = await patch_mine(client, provider, listing.id, {"description": "Open day and night."})

    assert read.status_code == 200 and read.json()["name"] == "Eze Clinic"
    assert edit.status_code == 200 and edit.json()["description"] == "Open day and night."


@pytest.mark.parametrize("status", ["pending", "removed"])
async def test_a_pending_or_removed_link_cannot_read_edit_or_use_the_old_route(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], status: str
) -> None:
    provider = demo_users[Role.provider]
    listing = await clinic(session)
    await link(session, listing, provider, status=status)

    assert (await get_mine(client, provider, listing.id)).status_code == 404
    assert (await patch_mine(client, provider, listing.id, {"description": "x"})).status_code == 404
    old = await get_mine(client, provider)
    assert (old.status_code, old.json()["detail"]) == (404, NO_LISTING)


async def test_owner_id_alone_gives_no_access_any_more(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    provider = demo_users[Role.provider]
    listing = await clinic(session)
    listing.owner_id = provider.id  # the old column, still in the table, no longer read
    session.add(listing)
    await session.commit()

    assert (await get_mine(client, provider, listing.id)).status_code == 404
    assert (await get_mine(client, provider)).status_code == 404


async def test_a_listing_with_no_link_and_an_unknown_listing_look_the_same(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    provider = demo_users[Role.provider]
    listing = await clinic(session)

    unlinked = await get_mine(client, provider, listing.id)
    unknown = await get_mine(client, provider, 99999)

    assert unlinked.status_code == unknown.status_code == 404
    assert unlinked.json() == unknown.json()


async def test_a_manager_edits_but_cannot_pay(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    provider = demo_users[Role.provider]
    listing = await clinic(session)
    await link(session, listing, provider, role="manager")

    edit = await patch_mine(client, provider, listing.id, {"description": "Managed."})
    pay = await pay_for_featured(client, provider)

    assert edit.status_code == 200
    assert (pay.status_code, pay.json()["detail"]) == (403, "Only an owner can pay.")


@pytest.mark.parametrize("status", ["pending", "removed"])
async def test_a_pending_or_removed_owner_cannot_pay(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], status: str
) -> None:
    provider = demo_users[Role.provider]
    await link(session, await clinic(session), provider, status=status)

    pay = await pay_for_featured(client, provider)

    assert (pay.status_code, pay.json()["detail"]) == (404, NO_LISTING)


async def test_two_owners_share_a_listing_and_one_owner_has_two_listings(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], demo_password_hash: str
) -> None:
    first = demo_users[Role.provider]
    second = await new_provider(session, 2, demo_password_hash)
    shared = await clinic(session, "Shared Clinic")
    other = await clinic(session, "Second Clinic")
    await link(session, shared, first)
    await link(session, shared, second, role="manager")
    await link(session, other, first)

    assert (await patch_mine(client, first, shared.id, {"description": "One."})).status_code == 200
    assert (await patch_mine(client, second, shared.id, {"description": "Two."})).status_code == 200
    assert (await patch_mine(client, first, other.id, {"description": "Three."})).status_code == 200
    assert (await patch_mine(client, second, other.id, {"description": "No."})).status_code == 404


async def test_the_list_of_my_facilities_shows_every_link_with_its_state_and_nothing_else(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], demo_password_hash: str
) -> None:
    provider = demo_users[Role.provider]
    stranger = await new_provider(session, 2, demo_password_hash)
    approved = await clinic(session, "Approved Clinic")
    waiting = await clinic(session, "Waiting Clinic")
    gone = await clinic(session, "Removed Clinic")
    secret = await clinic(session, "Somebody Else Clinic")
    await link(session, approved, provider)
    await link(session, waiting, provider, role="manager", status="pending")
    await link(session, gone, provider, status="removed")
    await link(session, secret, stranger)

    response = await client.get("/provider/listings", headers=bearer_for(provider))

    assert response.status_code == 200
    items = response.json()["items"]
    assert [(item["name"], item["role"], item["status"]) for item in items] == [
        ("Approved Clinic", "owner", "approved"),
        ("Waiting Clinic", "manager", "pending"),
        ("Removed Clinic", "owner", "removed"),
    ]
    assert set(items[0]) == {
        "link_id", "listing_id", "name", "area", "category", "role", "status", "requested_at",
    }
    assert "Somebody Else" not in response.text and "phone" not in response.text


async def test_the_old_route_acts_on_the_approved_link_with_the_lowest_listing_id(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    provider = demo_users[Role.provider]
    first = await clinic(session, "First Clinic")
    second = await clinic(session, "Second Clinic")
    await link(session, second, provider)
    await link(session, first, provider, status="pending")

    response = await get_mine(client, provider)

    assert response.status_code == 200 and response.json()["name"] == "Second Clinic"


async def test_a_staff_role_and_no_login_are_refused_on_the_provider_routes(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    listing = await clinic(session)

    assert (await get_mine(client, demo_users[Role.editor], listing.id)).status_code == 403
    assert (await get_mine(client, None, listing.id)).status_code == 401
    assert (await client.get("/provider/listings")).status_code == 401
    admin_headers = bearer_for(demo_users[Role.admin])
    assert (await client.get("/provider/listings", headers=admin_headers)).status_code == 403


# --- the staff queue ---


async def test_the_queue_shows_the_pending_links_oldest_first_with_the_numbers_to_call(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], demo_password_hash: str
) -> None:
    provider = demo_users[Role.provider]
    other = await new_provider(session, 2, demo_password_hash)
    first = await clinic(session, "First Clinic")
    second = await clinic(session, "Second Clinic")
    await link(session, first, provider, status="pending")
    await link(session, second, other, role="manager", status="pending")
    await link(session, second, provider, status="approved")  # not waiting: not in the queue

    response = await client.get("/staff/owner-requests", headers=bearer_for(demo_users[Role.editor]))

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    first_item, second_item = body["items"]
    assert first_item["person"] == {
        "id": provider.id, "name": provider.name, "email": provider.email, "phone": provider.phone,
    }
    assert first_item["listing"]["name"] == "First Clinic"
    assert first_item["listing"]["phones"] == [
        {"number": "+2340000000555", "label": None, "is_primary": True}
    ]
    assert (second_item["role"], second_item["person"]["id"]) == ("manager", other.id)
    assert set(first_item) == {"id", "role", "requested_at", "person", "listing"}
    assert "password" not in response.text and "hash" not in response.text


@pytest.mark.parametrize("role", [Role.verifier, Role.provider])
async def test_a_verifier_and_a_provider_get_403_on_the_whole_queue(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], role: Role
) -> None:
    pending = await link(session, await clinic(session), demo_users[Role.provider], status="pending")
    headers = bearer_for(demo_users[role])

    assert (await client.get("/staff/owner-requests", headers=headers)).status_code == 403
    for action in ("approve", "reject", "remove"):
        response = await client.post(
            f"/staff/owner-requests/{pending.id}/{action}", json={"note": CALL_NOTE}, headers=headers
        )
        assert response.status_code == 403, action
    await session.refresh(pending)
    assert pending.status == "pending"


async def test_without_a_login_the_queue_is_401(client: AsyncClient) -> None:
    assert (await client.get("/staff/owner-requests")).status_code == 401
    assert (await decide(client, None, 1, "approve", {"note": "x"})).status_code == 401


@pytest.mark.parametrize("staff_role", [Role.editor, Role.admin])
async def test_approving_needs_the_note_then_lets_the_provider_edit_and_is_audited(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], staff_role: Role
) -> None:
    staff, provider = demo_users[staff_role], demo_users[Role.provider]
    listing = await clinic(session)
    pending = await link(session, listing, provider, status="pending")
    assert (await patch_mine(client, provider, listing.id, {"description": "x"})).status_code == 404

    response = await decide(client, staff, pending.id, "approve", {"note": CALL_NOTE})

    assert response.status_code == 200, response.text
    body = response.json()
    assert (body["status"], body["role"], body["note"]) == ("approved", "owner", CALL_NOTE)
    assert body["approved_by"] == staff.id and body["approved_at"] is not None
    assert (await patch_mine(client, provider, listing.id, {"description": "Now yes."})).status_code == 200
    [entry] = await audit(session, "owner_approve")
    assert (entry.user_id, entry.listing_id, entry.field_changed) == (staff.id, listing.id, "status")
    assert (entry.old_value, entry.new_value) == ("pending", "approved")
    assert entry.reference == f"user:{provider.id}"
    assert CALL_NOTE not in str(entry.model_dump()) and "+234" not in str(entry.model_dump())


@pytest.mark.parametrize("body", [{}, {"note": ""}, {"note": "   "}, {"note": "x" * 301}, None])
async def test_approving_without_a_proper_note_is_422_and_changes_nothing(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], body: dict | None
) -> None:
    pending = await link(session, await clinic(session), demo_users[Role.provider], status="pending")

    response = await decide(client, demo_users[Role.editor], pending.id, "approve", body)

    assert response.status_code == 422
    await session.refresh(pending)
    assert pending.status == "pending" and pending.approved_by is None


async def test_approve_and_reject_need_a_pending_link_and_remove_an_approved_one(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], demo_password_hash: str
) -> None:
    editor, provider = demo_users[Role.editor], demo_users[Role.provider]
    other = await new_provider(session, 2, demo_password_hash)
    listing = await clinic(session)
    approved = await link(session, listing, provider)
    pending = await link(session, listing, other, status="pending")
    note = {"note": CALL_NOTE}

    for action, target in (("approve", approved), ("reject", approved), ("remove", pending)):
        response = await decide(client, editor, target.id, action, note)
        assert (response.status_code, response.json()["detail"]) == (
            409, "This request is not waiting." if action != "remove" else "This link is not approved.",
        ), action


async def test_an_unknown_request_is_404(client: AsyncClient, demo_users: dict[Role, User]) -> None:
    response = await decide(client, demo_users[Role.editor], 99999, "approve", {"note": CALL_NOTE})

    assert (response.status_code, response.json()["detail"]) == (404, "Request not found")


async def test_rejecting_sets_removed_with_the_staff_member_and_is_audited(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    editor, provider = demo_users[Role.editor], demo_users[Role.provider]
    listing = await clinic(session)
    pending = await link(session, listing, provider, status="pending")

    response = await decide(client, editor, pending.id, "reject", {"note": "Nobody there knew them."})

    assert response.status_code == 200 and response.json()["status"] == "removed"
    assert response.json()["removed_by"] == editor.id and response.json()["removed_at"] is not None
    assert (await get_mine(client, provider, listing.id)).status_code == 404
    [entry] = await audit(session, "owner_reject")
    assert (entry.old_value, entry.new_value, entry.reference) == (
        "pending", "removed", f"user:{provider.id}",
    )


async def test_rejecting_needs_no_note(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    pending = await link(session, await clinic(session), demo_users[Role.provider], status="pending")

    response = await decide(client, demo_users[Role.editor], pending.id, "reject", None)

    assert response.status_code == 200 and response.json()["note"] is None


async def test_removing_takes_the_access_away_at_once_and_is_audited(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    editor, provider = demo_users[Role.editor], demo_users[Role.provider]
    listing = await clinic(session)
    approved = await link(session, listing, provider)
    assert (await patch_mine(client, provider, listing.id, {"description": "Before."})).status_code == 200

    response = await decide(client, editor, approved.id, "remove", {"note": "They sold the clinic."})

    assert response.status_code == 200 and response.json()["status"] == "removed"
    assert (await patch_mine(client, provider, listing.id, {"description": "After."})).status_code == 404
    [entry] = await audit(session, "owner_remove")
    assert (entry.old_value, entry.new_value) == ("approved", "removed")


async def test_asking_again_after_a_removal_uses_the_same_row_and_waits_again(
    session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    from datetime import datetime, timezone

    from app.repositories import facility_owner_repository as owners

    provider = demo_users[Role.provider]
    listing = await clinic(session)
    removed = await link(session, listing, provider, status="removed")
    removed.removed_at, removed.removed_by, removed.note = datetime.now(timezone.utc), 1, "old note"
    session.add(removed)
    await session.commit()

    again = await owners.request_link(session, listing.id, provider.id, "manager", datetime.now(timezone.utc))
    await session.commit()

    rows = (await session.exec(select(FacilityOwner))).all()
    assert len(rows) == 1 and again.id == removed.id
    assert (again.status, again.role) == ("pending", "manager")
    assert (again.removed_at, again.removed_by, again.approved_at, again.note) == (None, None, None, None)


async def test_a_second_request_for_a_link_that_waits_or_is_approved_changes_nothing(
    session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    from datetime import datetime, timezone

    from app.repositories import facility_owner_repository as owners

    provider = demo_users[Role.provider]
    approved = await link(session, await clinic(session), provider)

    again = await owners.request_link(
        session, approved.listing_id, provider.id, "manager", datetime.now(timezone.utc)
    )

    assert (again.id, again.status, again.role) == (approved.id, "approved", "owner")


# --- other ways a link is made or ended ---


async def test_the_admin_option_that_links_a_listing_makes_an_approved_owner_link(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    provider = demo_users[Role.provider]
    listing = await clinic(session)

    response = await client.patch(
        f"/admin/users/{provider.id}", json={"listing_id": listing.id},
        headers=bearer_for(demo_users[Role.admin]),
    )

    assert response.status_code == 200, response.text
    [made] = (await session.exec(select(FacilityOwner))).all()
    assert (made.listing_id, made.user_id, made.role, made.status) == (
        listing.id, provider.id, "owner", "approved",
    )
    assert (await get_mine(client, provider, listing.id)).status_code == 200


async def test_closing_the_account_removes_every_link_of_the_person(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    provider = demo_users[Role.provider]
    await link(session, await clinic(session, "One"), provider)
    await link(session, await clinic(session, "Two"), provider, status="pending")

    response = await client.post(
        "/account/close", headers=bearer_for(provider),
        json={"password": DEMO_PASSWORD, "confirmation": "CLOSE"},
    )

    assert response.status_code == 200
    links = (await session.exec(select(FacilityOwner))).all()
    assert {link.status for link in links} == {"removed"}
    assert all(link.removed_at is not None for link in links)


async def test_the_queue_and_decision_routes_are_in_the_list_of_routes_that_need_a_login() -> None:
    from tests.integration.test_account_state import routes_that_need_a_login

    found = routes_that_need_a_login()

    for route in [
        ("GET", "/provider/listings"), ("GET", "/provider/listings/1"), ("PATCH", "/provider/listings/1"),
        ("GET", "/staff/owner-requests"), ("POST", "/staff/owner-requests/1/approve"),
        ("POST", "/staff/owner-requests/1/reject"), ("POST", "/staff/owner-requests/1/remove"),
    ]:
        assert route in found


async def test_no_route_deletes_a_user_or_a_listing_or_a_link() -> None:
    from app.main import app

    deleting = [
        path for path, operations in app.openapi()["paths"].items() if "delete" in operations
    ]

    assert deleting == []

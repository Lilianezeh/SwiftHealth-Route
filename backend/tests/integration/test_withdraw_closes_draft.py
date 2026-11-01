"""Withdrawing a draft or an unpaid request closes the listing that request made.
Requirements: FR-50, FR-53, NFR-06.
Spec: specs/2026-11-01-close-withdrawn-draft/ (the owner's answer of 2026-11-01).

When an owner deletes a saved draft or withdraws a request that was never paid, the draft listing that only
that request made is closed the way the nightly clean-up closes an unpaid one: hidden, `closed_at`,
`closed_reason` "unpaid". Nothing is deleted, staff never see it, and the same phone number can be registered
again. A listing that staff made, a published listing someone only asked to claim, and a draft another person
also has a link to are never touched. Every person and facility here is fictional.
"""

from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment
from app.main import app
from app.models import AuditEntry, FacilityOwner, Listing, User
from app.models.base import ListingStatus, Role
from app.repositories import user_repository
from tests.factories import add_listing, add_owner_link, get_or_add_category
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 11, 2, 9, 0, tzinfo=timezone.utc)
FORM = {
    "facility_name": "Withdrawn Clinic",
    "category": "clinic",
    "area": "Ogui",
    "address": "4 Example Street",
    "phone": "08030000321",
}


@pytest.fixture(autouse=True)
def clock():
    app.dependency_overrides[get_current_moment] = lambda: NOW
    yield
    app.dependency_overrides.pop(get_current_moment, None)


@pytest.fixture(autouse=True)
async def clinic_category(session: AsyncSession) -> None:
    await get_or_add_category(session, "clinic", "Clinic")
    await session.commit()


async def withdraw(client: AsyncClient, user: User, link_id: int):
    return await client.post(f"/provider/links/{link_id}/cancel", headers=bearer_for(user))


async def register(client: AsyncClient, user: User, **changes: object):
    return await client.post(
        "/provider/facilities",
        json={**FORM, **changes},
        headers={**bearer_for(user), "x-forwarded-for": "203.0.113.31"},
    )


async def entries(session: AsyncSession, action: str) -> list[AuditEntry]:
    rows = await session.exec(select(AuditEntry).where(AuditEntry.action == action).order_by(AuditEntry.id))
    return list(rows.all())


async def the_listing(session: AsyncSession, listing_id: int) -> Listing:
    listing = await session.get(Listing, listing_id, populate_existing=True)
    assert listing is not None  # never deleted
    return listing


@pytest.mark.parametrize("save_as_draft", [True, False], ids=["a draft", "an unpaid request"])
async def test_withdrawing_what_the_form_made_closes_its_listing_and_deletes_nothing(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], save_as_draft: bool
) -> None:
    provider = demo_users[Role.provider]
    saved = (await register(client, provider, save_as_draft=save_as_draft)).json()

    response = await withdraw(client, provider, saved["link_id"])

    assert response.status_code == 200 and response.json()["status"] == "removed"
    listing = await the_listing(session, saved["listing_id"])
    assert (listing.status, listing.closed_at, listing.closed_reason) == (ListingStatus.hidden, NOW, "unpaid")
    [closed] = await entries(session, "close")
    assert (closed.listing_id, closed.old_value, closed.new_value, closed.reference) == (
        listing.id,
        "draft",
        "hidden",
        "withdrawn",
    )
    assert closed.user_id == provider.id  # the owner did it


async def test_staff_see_nothing_of_the_closed_draft(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    provider, editor = demo_users[Role.provider], demo_users[Role.editor]
    saved = (await register(client, provider, save_as_draft=True)).json()
    await withdraw(client, provider, saved["link_id"])

    listed = await client.get("/listings", headers=bearer_for(editor))
    hidden = await client.get("/listings", headers=bearer_for(editor), params={"status": "hidden"})

    assert all(item["name"] != "Withdrawn Clinic" for item in listed.json()["items"] + hidden.json()["items"])


async def test_the_same_phone_can_be_registered_again_after_a_withdrawal(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    provider = demo_users[Role.provider]
    saved = (await register(client, provider, save_as_draft=True)).json()
    await withdraw(client, provider, saved["link_id"])

    again = await register(client, provider, save_as_draft=True)

    assert again.status_code == 201


async def test_a_listing_that_staff_made_is_never_closed(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    provider, editor = demo_users[Role.provider], demo_users[Role.editor]
    listing = await add_listing(
        session, "Staff Draft Clinic", category_slug="clinic", status=ListingStatus.draft
    )
    listing.created_by = editor.id
    link = await add_owner_link(session, listing, provider, status="awaiting_payment")
    await session.commit()

    await withdraw(client, provider, link.id)

    after = await the_listing(session, listing.id)
    assert (after.status, after.closed_at, after.closed_reason) == (ListingStatus.draft, None, None)


async def test_a_published_listing_that_someone_only_asked_to_claim_is_never_closed(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    provider = demo_users[Role.provider]
    listing = await add_listing(session, "Public Clinic", category_slug="clinic")
    link = await add_owner_link(session, listing, provider, status="awaiting_payment")
    await session.commit()

    await withdraw(client, provider, link.id)

    after = await the_listing(session, listing.id)
    assert (after.status, after.closed_at) == (ListingStatus.published, None)


async def test_a_draft_another_person_also_has_a_link_to_is_not_closed(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], demo_password_hash: str
) -> None:
    provider = demo_users[Role.provider]
    other = await user_repository.create(
        session,
        name="Other Owner",
        email="other-owner-2@demo.example.com",
        phone="+2340000000779",
        password_hash=demo_password_hash,
        role=Role.provider,
    )
    listing = await add_listing(
        session, "Shared Draft Clinic", category_slug="clinic", status=ListingStatus.draft
    )
    mine = await add_owner_link(session, listing, provider, status="draft")
    await add_owner_link(session, listing, other, status="awaiting_payment")
    await session.commit()

    await withdraw(client, provider, mine.id)

    after = await the_listing(session, listing.id)
    assert (after.status, after.closed_at) == (ListingStatus.draft, None)


async def test_the_link_is_removed_and_the_owner_is_the_one_who_removed_it(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    provider = demo_users[Role.provider]
    saved = (await register(client, provider, save_as_draft=True)).json()

    await withdraw(client, provider, saved["link_id"])

    link = await session.get(FacilityOwner, saved["link_id"], populate_existing=True)
    assert link is not None and (link.status, link.removed_by) == ("removed", provider.id)

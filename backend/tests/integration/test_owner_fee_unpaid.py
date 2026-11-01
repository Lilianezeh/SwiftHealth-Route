"""The clean-up of requests that were never paid. Requirements: FR-50, FR-53, FR-59.
Spec: specs/2026-10-29-owner-fee/.

A register or claim request waits as `awaiting_payment` until the first month is paid. One that is
still unpaid after 14 days (setting OWNER_FEE_UNPAID_DAYS) is ended by the nightly job: the link is
removed, and a draft listing that only that request made is closed (`closed_at`, `closed_reason`
"unpaid", status hidden). Nothing is ever deleted. Staff never see an unpaid request: not in the
owner requests, the listing list, the dashboard numbers or the CSV export. A published listing that
someone only asked to claim is never touched. Every person and facility here is fictional.
"""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.jobs import owner_fee
from app.models import AuditEntry, FacilityOwner, Listing, User
from app.models.base import ListingStatus, Role
from tests.factories import add_listing, add_owner_link
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 11, 20, 0, 0, tzinfo=timezone.utc)
_count = 0


async def unpaid_draft(
    session: AsyncSession, provider: User, *, age: timedelta, status: str = "awaiting_payment"
) -> tuple[Listing, FacilityOwner]:
    """What registering makes: a draft nobody created, and a link that waits for the first payment."""
    global _count
    _count += 1
    listing = await add_listing(session, f"Unpaid Clinic {_count}", status=ListingStatus.draft)
    link = await add_owner_link(session, listing, provider, status=status)
    link.requested_at = NOW - age
    await session.commit()
    return listing, link


async def refreshed(session: AsyncSession, *rows: object) -> None:
    for row in rows:
        await session.refresh(row)


async def entries(session: AsyncSession, action: str) -> list[AuditEntry]:
    rows = await session.exec(select(AuditEntry).where(AuditEntry.action == action).order_by(AuditEntry.id))
    return list(rows.all())


# --- the 14 days ---


async def test_a_register_draft_never_paid_in_14_days_is_closed_as_unpaid_and_not_deleted(
    session, demo_users
):
    provider = demo_users[Role.provider]
    listing, link = await unpaid_draft(session, provider, age=timedelta(days=14, seconds=1))

    result = await owner_fee.run_on(session, NOW)

    assert result.unpaid_closed == 1
    await refreshed(session, listing, link)
    assert (listing.status, listing.closed_at, listing.closed_reason) == (ListingStatus.hidden, NOW, "unpaid")
    assert (link.status, link.removed_at, link.removed_by) == ("removed", NOW, None)
    assert (await session.get(Listing, listing.id)) is not None  # still there
    [removed] = await entries(session, "owner_unpaid")
    assert (removed.old_value, removed.new_value, removed.user_id) == ("awaiting_payment", "removed", None)
    assert removed.reference == f"user:{provider.id}"
    [closed] = await entries(session, "close")
    assert (closed.listing_id, closed.old_value, closed.new_value, closed.reference) == (
        listing.id,
        "draft",
        "hidden",
        "unpaid",
    )


async def test_exactly_14_days_and_less_are_left_alone(session, demo_users):
    provider = demo_users[Role.provider]
    on_the_day, _ = await unpaid_draft(session, provider, age=timedelta(days=14))
    recent, recent_link = await unpaid_draft(session, provider, age=timedelta(days=3))

    result = await owner_fee.run_on(session, NOW)

    assert result.unpaid_closed == 0
    await refreshed(session, on_the_day, recent, recent_link)
    assert on_the_day.closed_at is None and recent.closed_at is None
    assert recent_link.status == "awaiting_payment"


async def test_the_number_of_days_is_a_setting(session, demo_users, monkeypatch):
    provider = demo_users[Role.provider]
    listing, _ = await unpaid_draft(session, provider, age=timedelta(days=4))
    monkeypatch.setattr(settings, "owner_fee_unpaid_days", 3)

    assert (await owner_fee.run_on(session, NOW)).unpaid_closed == 1
    await refreshed(session, listing)
    assert listing.closed_reason == "unpaid"


# --- what is never touched ---


@pytest.mark.parametrize("status", ["pending", "approved", "lapsed", "ending", "removed"])
async def test_a_request_that_was_paid_or_decided_is_never_cleaned_up(session, demo_users, status):
    provider = demo_users[Role.provider]
    listing, link = await unpaid_draft(session, provider, age=timedelta(days=60), status=status)

    result = await owner_fee.run_on(session, NOW)

    assert result.unpaid_closed == 0
    await refreshed(session, listing)
    assert listing.closed_at is None and listing.status == ListingStatus.draft


async def test_an_unpaid_claim_on_a_published_listing_only_ends_the_request_the_listing_is_untouched(
    session, demo_users
):
    provider = demo_users[Role.provider]
    listing = await add_listing(session, "Published Clinic")  # published, made long ago by someone else
    link = await add_owner_link(session, listing, provider, status="awaiting_payment")
    link.requested_at = NOW - timedelta(days=30)
    await session.commit()

    result = await owner_fee.run_on(session, NOW)

    assert result.unpaid_closed == 1
    await refreshed(session, listing, link)
    assert link.status == "removed"
    assert (listing.status, listing.closed_at, listing.closed_reason) == (ListingStatus.published, None, None)
    assert await entries(session, "close") == []


async def test_a_draft_with_another_live_request_or_made_by_staff_is_not_closed(session, demo_users):
    provider, verifier = demo_users[Role.provider], demo_users[Role.verifier]
    shared, link = await unpaid_draft(session, provider, age=timedelta(days=30))
    await add_owner_link(session, shared, verifier, status="pending")  # somebody else's paid request
    by_staff, _ = await unpaid_draft(session, provider, age=timedelta(days=30))
    by_staff.created_by = verifier.id  # a verifier's own draft, not a registration
    await session.commit()

    result = await owner_fee.run_on(session, NOW)

    assert result.unpaid_closed == 2  # both unpaid requests end...
    await refreshed(session, shared, by_staff, link)
    assert link.status == "removed"
    assert shared.closed_at is None and by_staff.closed_at is None  # ...but neither listing is closed
    assert shared.status == ListingStatus.draft and by_staff.status == ListingStatus.draft


async def test_running_it_again_changes_nothing(session, demo_users):
    provider = demo_users[Role.provider]
    await unpaid_draft(session, provider, age=timedelta(days=30))

    first = await owner_fee.run_on(session, NOW)
    second = await owner_fee.run_on(session, NOW + timedelta(days=1))

    assert (first.unpaid_closed, second.unpaid_closed) == (1, 0)
    assert len(await entries(session, "close")) == 1


# --- never shown to staff ---


async def staff_list(client: AsyncClient, user: User) -> list[str]:
    response = await client.get("/listings?limit=100", headers=bearer_for(user))
    assert response.status_code == 200
    return [item["name"] for item in response.json()["items"]]


async def test_staff_never_see_an_unpaid_request_before_during_or_after_the_clean_up(
    client: AsyncClient, session: AsyncSession, demo_users
):
    provider, editor, admin = demo_users[Role.provider], demo_users[Role.editor], demo_users[Role.admin]
    visible = await add_listing(session, "Visible Clinic")
    waiting, _ = await unpaid_draft(session, provider, age=timedelta(days=2))
    old, _ = await unpaid_draft(session, provider, age=timedelta(days=30))
    paid, paid_link = await unpaid_draft(session, provider, age=timedelta(days=2))
    paid_link.status = "pending"  # the first month is paid: now staff see the draft and the request
    await session.commit()

    for staff in (editor, admin):  # unpaid: hidden from the first day
        assert await staff_list(client, staff) == sorted([visible.name, paid.name])
    await owner_fee.run_on(session, NOW)  # and still hidden after the clean-up closed the old one
    for staff in (editor, admin):
        assert await staff_list(client, staff) == sorted([visible.name, paid.name])
    queue = await client.get("/staff/owner-requests", headers=bearer_for(editor))
    assert [item["listing"]["name"] for item in queue.json()["items"]] == [paid.name]
    await refreshed(session, waiting, old)
    assert (
        waiting.closed_at is None and old.closed_reason == "unpaid"
    )  # the rows exist; staff just never see them


async def test_the_dashboard_numbers_and_the_csv_export_leave_unpaid_requests_out(
    client: AsyncClient, session: AsyncSession, demo_users
):
    provider, admin = demo_users[Role.provider], demo_users[Role.admin]
    await add_listing(session, "Counted Clinic")
    await unpaid_draft(session, provider, age=timedelta(days=2))
    await unpaid_draft(session, provider, age=timedelta(days=30))
    await owner_fee.run_on(session, NOW)

    stats = await client.get("/dashboard/stats", headers=bearer_for(admin))
    export = await client.get("/admin/export?type=listings", headers=bearer_for(admin))

    assert stats.json()["listings_by_status"] == {
        "draft": 0,
        "pending_review": 0,
        "published": 1,
        "recheck_due": 0,
        "hidden": 0,
    }
    assert "Counted Clinic" in export.text and "Unpaid Clinic" not in export.text


async def test_the_listing_is_never_deleted_staff_can_still_open_it_by_its_id(
    client: AsyncClient, session: AsyncSession, demo_users
):
    provider, editor = demo_users[Role.provider], demo_users[Role.editor]
    listing, _ = await unpaid_draft(session, provider, age=timedelta(days=30))
    await owner_fee.run_on(session, NOW)

    response = await client.get(f"/listings/id/{listing.id}", headers=bearer_for(editor))

    assert response.status_code == 200
    assert response.json()["closed_reason"] == "unpaid"


# --- asking again ---

REGISTER_BODY = {
    "facility_name": "Fresh Example Clinic",
    "category": "clinic",
    "area": "Ogui",
    "address": "4 Example Street",
    "phone": "0803 000 0000",
    "role": "owner",
}


async def test_after_the_clean_up_the_same_person_can_register_the_same_facility_again(
    client: AsyncClient, session: AsyncSession, demo_users
):
    provider = demo_users[Role.provider]
    await add_listing(session, "Other Clinic", category_slug="clinic")  # makes the clinic category
    await session.commit()
    first = await client.post("/provider/facilities", json=REGISTER_BODY, headers=bearer_for(provider))
    assert first.status_code == 201
    again_too_early = await client.post(
        "/provider/facilities", json=REGISTER_BODY, headers=bearer_for(provider)
    )
    assert again_too_early.status_code == 409  # the open request still counts as a duplicate
    link = (
        await session.exec(select(FacilityOwner).where(FacilityOwner.id == first.json()["link_id"]))
    ).one()
    link.requested_at = NOW - timedelta(days=15)
    await session.commit()

    await owner_fee.run_on(session, NOW)
    second = await client.post("/provider/facilities", json=REGISTER_BODY, headers=bearer_for(provider))

    assert second.status_code == 201
    assert second.json()["listing_id"] != first.json()["listing_id"]
    assert second.json()["status"] == "awaiting_payment"

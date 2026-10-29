"""What the owner fee does to editing. Requirements: FR-50, FR-45, FR-19, NFR-06.
Spec: specs/2026-10-29-owner-fee/.

A provider may manage a listing only through an `approved` link whose paid month (plus the 7 grace
days) has not ended, or an `ending` link until its paid month ends. A lapsed owner can no longer
edit, move, close or pay for Featured; the listing itself is not touched: it stays public and
free. Staff are never charged. Every person and facility here is fictional.
"""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.models import Listing, User
from app.models.base import Role
from tests.factories import add_listing, add_owner_link
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio

LAPSED_MESSAGE_CODES = (404,)  # a provider with no usable link is "not linked", as before


def ago(**duration: float) -> datetime:
    return datetime.now(timezone.utc) - timedelta(**duration)


def ahead(**duration: float) -> datetime:
    return datetime.now(timezone.utc) + timedelta(**duration)


async def setup_listing(session: AsyncSession, demo_users: dict[Role, User], **link_options: object):
    provider = demo_users[Role.provider]
    listing = await add_listing(session, "Fee Clinic")
    link = await add_owner_link(session, listing, provider, **link_options)
    await session.commit()
    return provider, listing, link


async def read_own(client: AsyncClient, provider: User):
    return await client.get("/provider/listing", headers=bearer_for(provider))


async def edit_own(client: AsyncClient, provider: User, listing: Listing):
    return await client.patch(
        f"/provider/listings/{listing.id}", json={"description": "New text"}, headers=bearer_for(provider)
    )


@pytest.mark.parametrize(
    ("status", "paid_until", "may_edit"),
    [
        ("approved", ahead(days=20), True),  # paid
        ("approved", ago(days=3), True),  # inside the 7 grace days
        ("approved", ago(days=8), False),  # lapsed, even if the nightly job has not run yet
        ("approved", None, False),  # no paid date never gives access
        ("lapsed", ahead(days=20), False),  # the stored status wins: pay first
        ("lapsed", ago(days=20), False),
        ("ending", ahead(days=2), True),  # cancelled, but the month is paid
        ("ending", ago(hours=1), False),  # the month is over: no grace after a cancel
        ("pending", ahead(days=20), False),  # paid, but staff have not approved
        ("awaiting_payment", None, False),
        ("removed", ahead(days=20), False),
    ],
)
async def test_editing_follows_the_status_and_the_paid_month(
    client: AsyncClient, session: AsyncSession, demo_users, status, paid_until, may_edit
):
    provider, listing, _ = await setup_listing(session, demo_users, status=status, paid_until=paid_until)

    read = await read_own(client, provider)
    edit = await edit_own(client, provider, listing)

    assert (read.status_code == 200) is may_edit
    assert (edit.status_code == 200) is may_edit
    if not may_edit:
        assert read.status_code == 404  # "not linked": the answer does not say why or whether it exists


async def test_the_grace_days_are_a_setting(
    client: AsyncClient, session: AsyncSession, demo_users, monkeypatch
):
    provider, listing, _ = await setup_listing(session, demo_users, paid_until=ago(days=3))
    monkeypatch.setattr(settings, "owner_fee_grace_days", 2)

    assert (await read_own(client, provider)).status_code == 404


async def test_a_lapsed_owner_cannot_move_close_or_read_the_history_but_the_listing_is_unchanged(
    client: AsyncClient, session: AsyncSession, demo_users
):
    provider, listing, _ = await setup_listing(session, demo_users, paid_until=ago(days=30))
    before = (listing.name, listing.status, listing.address, listing.featured_until)

    close = await client.post(
        f"/listings/{listing.id}/close", json={"reason": "closed"}, headers=bearer_for(provider)
    )
    history = await client.get(f"/listings/{listing.id}/address-history", headers=bearer_for(provider))

    assert close.status_code in (403, 404)
    assert history.status_code in (403, 404)
    await session.refresh(listing)
    assert (listing.name, listing.status, listing.address, listing.featured_until) == before
    public = await client.get(f"/listings/{listing.slug}")
    assert public.status_code == 200  # still public


async def test_a_lapsed_owner_cannot_buy_featured(client: AsyncClient, session: AsyncSession, demo_users):
    provider, _, _ = await setup_listing(session, demo_users, paid_until=ago(days=30))

    response = await client.post("/payments/featured", json={"plan": "monthly"}, headers=bearer_for(provider))

    assert response.status_code == 404  # no usable link


async def test_staff_are_never_charged_and_still_edit_any_listing(
    client: AsyncClient, session: AsyncSession, demo_users
):
    _, listing, _ = await setup_listing(session, demo_users, paid_until=ago(days=90))

    for role in (Role.editor, Role.admin):
        response = await client.patch(
            f"/listings/{listing.id}",
            json={"description": "Staff text"},
            headers=bearer_for(demo_users[role]),
        )
        assert response.status_code == 200, role

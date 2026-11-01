"""Rejecting a paid claim, withdrawing it, and cancelling. Requirements: FR-44, FR-46, FR-50, NFR-06.
Spec: specs/2026-10-29-owner-fee/ (section 3.5). A rejected claim gives the first payment back in
full and automatically (question Q10). Cancelling an approved link keeps editing to the end of the
paid month, with no refund of it (question Q4). The listing is never touched. Paystack and Resend
are replaced by recorders; nothing real is called. Every person and facility is fictional.
"""

from collections.abc import Iterator
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment
from app.core.config import settings
from app.integrations import paystack, resend
from app.main import app
from app.models import AuditEntry, FacilityOwner, User
from app.models.base import Role
from app.repositories import user_repository
from tests.factories import add_listing, add_owner_link
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 10, 29, 9, 0, tzinfo=timezone.utc)
REFERENCE = "SO-{link}-1730000000"
names: list[str] = []  # the names used so far in this test run; see paid_link


@pytest.fixture(autouse=True)
def test_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "paystack_secret_key", "sk_test_not_a_real_key")


@pytest.fixture
def clock() -> Iterator[None]:
    app.dependency_overrides[get_current_moment] = lambda: NOW
    yield
    app.dependency_overrides.pop(get_current_moment, None)


class Recorder:
    def __init__(self) -> None:
        self.refunds: list[str] = []
        self.refund_error: Exception | None = None
        self.emails: list[tuple[str, str, str]] = []

    async def create_refund(self, *, reference: str, **_: object) -> None:
        if self.refund_error:
            raise self.refund_error
        self.refunds.append(reference)

    async def send_email(self, to: str, subject: str, body: str, **_: object) -> None:
        self.emails.append((to, subject, body))


@pytest.fixture
def recorder(monkeypatch: pytest.MonkeyPatch) -> Recorder:
    made = Recorder()
    monkeypatch.setattr(paystack, "create_refund", made.create_refund)
    monkeypatch.setattr(resend, "send_email", made.send_email)
    return made


@pytest.fixture
async def stranger(session: AsyncSession, demo_password_hash: str) -> User:
    user = await user_repository.create(
        session,
        name="Other Provider",
        email="other@demo.example.com",
        phone="+2340000000777",
        password_hash=demo_password_hash,
        role=Role.provider,
    )
    await session.commit()
    return user


async def paid_link(session: AsyncSession, provider: User, status: str, *, paid: bool = True, **options):
    names.append(f"Cancel Clinic {len(names)}")  # one name for each listing: the slug is unique
    listing = await add_listing(session, names[-1])
    link = await add_owner_link(session, listing, provider, status=status, **options)
    if paid:
        session.add(
            AuditEntry(
                listing_id=listing.id,
                action="payment",
                field_changed="paid_until",
                reference=REFERENCE.format(link=link.id),
                changed_at=NOW,
            )
        )
    await session.commit()
    return listing, link


async def entries(session: AsyncSession, action: str) -> list[AuditEntry]:
    rows = await session.exec(select(AuditEntry).where(AuditEntry.action == action).order_by(AuditEntry.id))
    return list(rows.all())


async def reject(client: AsyncClient, editor: User, link: FacilityOwner):
    return await client.post(
        f"/staff/owner-requests/{link.id}/reject", json={"note": "Not theirs"}, headers=bearer_for(editor)
    )


async def cancel(client: AsyncClient, user: User | None, link_id: int):
    headers = bearer_for(user) if user else {}
    return await client.post(f"/provider/links/{link_id}/cancel", headers=headers)


# --- staff reject a paid claim ---


async def test_rejecting_a_paid_claim_refunds_the_whole_payment_and_tells_the_owner(
    client, session, demo_users, recorder, clock
):
    provider, editor = demo_users[Role.provider], demo_users[Role.editor]
    listing, link = await paid_link(session, provider, "pending", paid_until=NOW + timedelta(days=30))

    response = await reject(client, editor, link)

    assert response.status_code == 200
    body = response.json()
    assert (body["status"], body["refund"]) == ("removed", "done")
    assert recorder.refunds == [REFERENCE.format(link=link.id)]
    [done] = await entries(session, "refund")
    assert (done.reference, done.listing_id, done.user_id) == (
        REFERENCE.format(link=link.id),
        listing.id,
        editor.id,
    )
    [(to, subject, body_text)] = recorder.emails
    assert to == provider.email and "given back" in subject
    assert "@" not in body_text and "SO-" not in body_text  # no address and no reference in the text


async def test_a_refund_that_paystack_does_not_accept_is_pending_never_lost_and_the_rejection_stands(
    client, session, demo_users, recorder, clock
):
    provider, editor = demo_users[Role.provider], demo_users[Role.editor]
    _, link = await paid_link(session, provider, "pending", paid_until=NOW + timedelta(days=30))
    recorder.refund_error = paystack.RefundError("Paystack answered with HTTP 500.")

    response = await reject(client, editor, link)

    assert response.status_code == 200
    assert (response.json()["status"], response.json()["refund"]) == ("removed", "pending")
    assert (await entries(session, "refund")) == []
    [waiting] = await entries(session, "refund_pending")
    assert waiting.reference == REFERENCE.format(link=link.id)


async def test_a_second_pending_refund_for_the_same_payment_is_not_written_twice(
    client, session, demo_users, recorder, clock
):
    from app.services import owner_fee_service

    provider, editor = demo_users[Role.provider], demo_users[Role.editor]
    _, link = await paid_link(session, provider, "pending", paid_until=NOW + timedelta(days=30))
    recorder.refund_error = paystack.RefundError("down")
    await reject(client, editor, link)

    await owner_fee_service.refund_link_payment(session, link, None, NOW)

    assert len(await entries(session, "refund_pending")) == 1


async def test_rejecting_a_request_nobody_paid_for_has_no_refund(
    client, session, demo_users, recorder, clock
):
    provider, editor = demo_users[Role.provider], demo_users[Role.editor]
    _, link = await paid_link(session, provider, "pending", paid=False)

    response = await reject(client, editor, link)

    assert (response.status_code, response.json()["refund"]) == (200, None)
    assert recorder.refunds == [] and recorder.emails == []


async def test_approving_keeps_the_payment_no_refund(client, session, demo_users, recorder, clock):
    provider, editor = demo_users[Role.provider], demo_users[Role.editor]
    _, link = await paid_link(session, provider, "pending", paid_until=NOW + timedelta(days=30))

    response = await client.post(
        f"/staff/owner-requests/{link.id}/approve",
        json={"note": "Called the front desk"},
        headers=bearer_for(editor),
    )

    assert response.status_code == 200
    assert recorder.refunds == []
    await session.refresh(link)
    assert (link.status, link.paid_until) == ("approved", NOW + timedelta(days=30))


# --- the owner cancels ---


async def test_cancelling_an_approved_link_keeps_editing_to_the_end_of_the_paid_month_without_a_refund(
    client, session, demo_users, recorder, clock
):
    provider = demo_users[Role.provider]
    paid_until = NOW + timedelta(days=12)
    _, link = await paid_link(session, provider, "approved", paid_until=paid_until)

    response = await cancel(client, provider, link.id)

    assert response.status_code == 200
    assert response.json() == {
        "link_id": link.id,
        "status": "ending",
        "access_until": "2026-11-10T09:00:00Z",
        "refund": None,
    }
    assert recorder.refunds == []
    assert (await client.get("/provider/listing", headers=bearer_for(provider))).status_code == 200
    [audit] = await entries(session, "owner_cancel")
    assert (audit.old_value, audit.new_value, audit.user_id) == ("approved", "ending", provider.id)


async def test_a_link_that_never_gave_access_is_removed_at_once(client, session, demo_users, recorder, clock):
    provider = demo_users[Role.provider]
    for status in ("awaiting_payment", "lapsed"):
        _, link = await paid_link(session, provider, status, paid=False)
        response = await cancel(client, provider, link.id)
        assert (response.json()["status"], response.json()["access_until"], response.json()["refund"]) == (
            "removed",
            None,
            None,
        ), status
    assert recorder.refunds == []


async def test_withdrawing_a_paid_request_that_waits_for_staff_gives_the_payment_back(
    client, session, demo_users, recorder, clock
):
    provider = demo_users[Role.provider]
    _, link = await paid_link(session, provider, "pending", paid_until=NOW + timedelta(days=30))

    response = await cancel(client, provider, link.id)

    assert (response.json()["status"], response.json()["refund"]) == ("removed", "done")
    assert recorder.refunds == [REFERENCE.format(link=link.id)]


@pytest.mark.parametrize("status", ["ending", "removed"])
async def test_cancelling_twice_is_409(client, session, demo_users, recorder, clock, status):
    provider = demo_users[Role.provider]
    _, link = await paid_link(session, provider, status, paid=False)

    assert (await cancel(client, provider, link.id)).status_code == 409


async def test_only_the_owner_of_the_link_can_cancel_it(
    client, session, demo_users, recorder, clock, stranger
):
    provider = demo_users[Role.provider]
    _, link = await paid_link(session, provider, "approved")

    assert (await cancel(client, stranger, link.id)).status_code == 404
    assert (await cancel(client, demo_users[Role.editor], link.id)).status_code == 403
    assert (await cancel(client, None, link.id)).status_code == 401
    assert (await cancel(client, provider, link.id + 999)).status_code == 404
    await session.refresh(link)
    assert link.status == "approved"


async def test_cancelling_never_touches_the_listing(client, session, demo_users, recorder, clock):
    provider = demo_users[Role.provider]
    listing, link = await paid_link(session, provider, "approved")
    before = (listing.name, listing.status, listing.address, listing.featured_until)

    await cancel(client, provider, link.id)

    await session.refresh(listing)
    assert (listing.name, listing.status, listing.address, listing.featured_until) == before
    assert (await client.get(f"/listings/{listing.slug}")).status_code == 200


# --- my facilities shows the fee ---


async def test_my_facilities_shows_the_fee_the_paid_date_and_where_each_link_is(
    client, session, demo_users, recorder, clock
):
    provider = demo_users[Role.provider]
    await paid_link(session, provider, "approved", paid_until=NOW + timedelta(days=5))
    await paid_link(session, provider, "approved", paid_until=NOW - timedelta(days=2))
    await paid_link(session, provider, "awaiting_payment", paid=False)

    body = (await client.get("/provider/listings", headers=bearer_for(provider))).json()

    assert (body["fee_naira"], body["grace_days"]) == ("10000.00", 7)
    assert sorted(item["fee_state"] for item in body["items"]) == ["awaiting_payment", "grace", "paid"]
    paid = next(item for item in body["items"] if item["fee_state"] == "paid")
    assert paid["paid_until"] == "2026-11-03T09:00:00Z"

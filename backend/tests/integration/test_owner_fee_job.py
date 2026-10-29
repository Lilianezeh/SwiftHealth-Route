"""The nightly owner-fee job: `python -m app.jobs.owner_fee`. Requirements: FR-50, FR-46, NFR-07.
Spec: specs/2026-10-29-owner-fee/ (sections 3.4 and 3.5). Each night it (1) moves links whose paid
month and grace period ended to `lapsed`, (2) removes cancelled links whose paid month ended,
(3) emails a reminder 7, 3 and 1 days before the paid month ends (once each), and (4) asks
Paystack again for refunds that were not accepted. Safe to run again. The clock is passed in;
Paystack and Resend are replaced by recorders. Fictional data.
"""

from datetime import datetime, timedelta, timezone

import pytest
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.integrations import paystack, resend
from app.jobs import owner_fee
from app.models import AuditEntry, FacilityOwner, User
from app.models.base import Role
from tests.factories import add_listing, add_owner_link

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 10, 29, 0, 0, tzinfo=timezone.utc)


class Recorder:
    def __init__(self) -> None:
        self.emails: list[tuple[str, str, str]] = []
        self.refunds: list[str] = []
        self.refund_error: Exception | None = None

    async def send_email(self, to: str, subject: str, body: str, **_: object) -> None:
        self.emails.append((to, subject, body))

    async def create_refund(self, *, reference: str, **_: object) -> None:
        if self.refund_error:
            raise self.refund_error
        self.refunds.append(reference)


@pytest.fixture(autouse=True)
def recorder(monkeypatch: pytest.MonkeyPatch) -> Recorder:
    monkeypatch.setattr(settings, "paystack_secret_key", "sk_test_not_a_real_key")
    made = Recorder()
    monkeypatch.setattr(resend, "send_email", made.send_email)
    monkeypatch.setattr(paystack, "create_refund", made.create_refund)
    return made


_count = 0


async def link_with(session: AsyncSession, provider: User, status: str, paid_until: datetime | None):
    global _count
    _count += 1
    listing = await add_listing(session, f"Job Clinic {_count}")
    link = await add_owner_link(session, listing, provider, status=status, paid_until=paid_until)
    await session.commit()
    return listing, link


async def status_of(session: AsyncSession, link: FacilityOwner) -> str:
    await session.refresh(link)
    return link.status


async def entries(session: AsyncSession, action: str) -> list[AuditEntry]:
    rows = await session.exec(select(AuditEntry).where(AuditEntry.action == action).order_by(AuditEntry.id))
    return list(rows.all())


# --- lapse ---


async def test_a_link_past_its_paid_month_and_the_grace_days_lapses_with_an_audit_entry_and_a_notice(
    session, demo_users, recorder
):
    provider = demo_users[Role.provider]
    _, late = await link_with(session, provider, "approved", NOW - timedelta(days=8))
    _, no_date = await link_with(session, provider, "approved", None)

    result = await owner_fee.run_on(session, NOW)

    assert result.lapsed == 2
    assert await status_of(session, late) == "lapsed" and await status_of(session, no_date) == "lapsed"
    first, _second = await entries(session, "owner_lapse")
    assert (first.field_changed, first.old_value, first.new_value, first.user_id) == (
        "status",
        "approved",
        "lapsed",
        None,
    )
    assert first.reference == f"user:{provider.id}"
    assert len(recorder.emails) == 2 and all(
        "can no longer edit" in subject for _to, subject, _b in recorder.emails
    )
    assert "still public and free" in recorder.emails[0][2]


async def test_links_that_are_still_paid_in_grace_or_in_another_state_are_left_alone(
    session, demo_users, recorder
):
    provider = demo_users[Role.provider]
    kept = [
        await link_with(session, provider, "approved", NOW + timedelta(days=20)),
        await link_with(session, provider, "approved", NOW - timedelta(days=7)),  # the 7th day still counts
        await link_with(session, provider, "pending", None),
        await link_with(session, provider, "awaiting_payment", None),
        await link_with(session, provider, "removed", None),
    ]
    before = [(link.status, link.paid_until) for _listing, link in kept]

    result = await owner_fee.run_on(session, NOW)

    assert result.lapsed == 0
    for _listing, link in kept:
        await session.refresh(link)
    assert [(link.status, link.paid_until) for _listing, link in kept] == before


async def test_the_grace_days_are_a_setting(session, demo_users, monkeypatch):
    provider = demo_users[Role.provider]
    _, link = await link_with(session, provider, "approved", NOW - timedelta(days=3))
    monkeypatch.setattr(settings, "owner_fee_grace_days", 2)

    await owner_fee.run_on(session, NOW)

    assert await status_of(session, link) == "lapsed"


async def test_a_lapse_never_touches_the_listing(session, demo_users):
    provider = demo_users[Role.provider]
    listing, _ = await link_with(session, provider, "approved", NOW - timedelta(days=60))
    before = (listing.name, listing.status, listing.featured_until, listing.updated_at)

    await owner_fee.run_on(session, NOW)

    await session.refresh(listing)
    assert (listing.name, listing.status, listing.featured_until, listing.updated_at) == before


# --- cancelled links end ---


async def test_a_cancelled_link_is_removed_when_its_paid_month_ends_and_not_before(
    session, demo_users, recorder
):
    provider = demo_users[Role.provider]
    _, over = await link_with(session, provider, "ending", NOW - timedelta(hours=1))
    _, still = await link_with(session, provider, "ending", NOW + timedelta(days=2))

    result = await owner_fee.run_on(session, NOW)

    assert result.ended == 1
    assert await status_of(session, over) == "removed" and await status_of(session, still) == "ending"
    await session.refresh(over)
    assert (over.removed_by, over.removed_at) == (provider.id, NOW)
    [audit] = await entries(session, "owner_end")
    assert (audit.old_value, audit.new_value) == ("ending", "removed")
    assert recorder.emails == []  # the owner chose this: no notice


# --- reminders ---


@pytest.mark.parametrize(("days", "wording"), [(7, "in 7 days"), (3, "in 3 days"), (1, "in 1 day")])
async def test_a_reminder_goes_out_7_3_and_1_days_before_the_paid_month_ends(
    session, demo_users, recorder, days, wording
):
    provider = demo_users[Role.provider]
    _, link = await link_with(session, provider, "approved", NOW + timedelta(days=days, hours=9))

    result = await owner_fee.run_on(session, NOW)

    assert result.reminders == 1
    [(to, subject, body)] = recorder.emails
    assert to == provider.email and wording in subject
    assert "Nothing is charged automatically" in body and "₦10,000.00" in body
    assert "grace period of 7 days" in body


async def test_no_reminder_on_the_other_days_or_for_links_that_are_not_paid(session, demo_users, recorder):
    provider = demo_users[Role.provider]
    for days in (30, 6, 5, 4, 2):
        await link_with(session, provider, "approved", NOW + timedelta(days=days, hours=9))
    await link_with(session, provider, "ending", NOW + timedelta(days=3, hours=9))
    await link_with(session, provider, "pending", NOW + timedelta(days=3, hours=9))

    result = await owner_fee.run_on(session, NOW)

    assert result.reminders == 0 and recorder.emails == []


async def test_the_days_are_a_setting(session, demo_users, recorder, monkeypatch):
    provider = demo_users[Role.provider]
    await link_with(session, provider, "approved", NOW + timedelta(days=10, hours=9))
    monkeypatch.setattr(settings, "owner_fee_reminder_days", "10")

    assert (await owner_fee.run_on(session, NOW)).reminders == 1


async def test_running_the_job_again_the_same_day_sends_nothing_twice(session, demo_users, recorder):
    provider = demo_users[Role.provider]
    await link_with(session, provider, "approved", NOW + timedelta(days=3, hours=9))
    await link_with(session, provider, "approved", NOW - timedelta(days=9))
    await link_with(session, provider, "ending", NOW - timedelta(days=1))

    first = await owner_fee.run_on(session, NOW)
    second = await owner_fee.run_on(session, NOW)

    assert (first.lapsed, first.ended, first.reminders) == (1, 1, 1)
    assert (second.lapsed, second.ended, second.reminders) == (0, 0, 0)
    assert len(recorder.emails) == 2  # one reminder, one lapse notice


async def test_after_a_renewal_the_next_month_gets_its_own_reminders(session, demo_users, recorder):
    provider = demo_users[Role.provider]
    _, link = await link_with(session, provider, "approved", NOW + timedelta(days=3, hours=9))
    await owner_fee.run_on(session, NOW)
    link.paid_until = NOW + timedelta(days=33, hours=9)  # paid for the next month
    await session.commit()

    later = NOW + timedelta(days=30)
    result = await owner_fee.run_on(session, later)

    assert result.reminders == 1
    assert len(recorder.emails) == 2


async def test_a_failing_email_does_not_stop_the_job(session, demo_users, monkeypatch):
    provider = demo_users[Role.provider]
    _, link = await link_with(session, provider, "approved", NOW - timedelta(days=9))

    async def failing(*_args: object, **_kwargs: object) -> None:
        raise resend.EmailSendError("down")

    monkeypatch.setattr(resend, "send_email", failing)

    result = await owner_fee.run_on(session, NOW)

    assert result.lapsed == 1 and await status_of(session, link) == "lapsed"


# --- refunds that were not accepted ---


async def pending_refund(session: AsyncSession, listing_id: int, reference: str) -> None:
    session.add(
        AuditEntry(listing_id=listing_id, action="refund_pending", reference=reference, changed_at=NOW)
    )
    await session.commit()


async def test_a_refund_paystack_did_not_accept_is_asked_for_again_until_it_is_done(
    session, demo_users, recorder
):
    provider = demo_users[Role.provider]
    listing, _ = await link_with(session, provider, "removed", None)
    await pending_refund(session, listing.id, "SO-5-1730000000")
    recorder.refund_error = paystack.RefundError("down")

    still = await owner_fee.run_on(session, NOW)
    recorder.refund_error = None
    done = await owner_fee.run_on(session, NOW + timedelta(days=1))
    again = await owner_fee.run_on(session, NOW + timedelta(days=2))

    assert (still.refunds_done, done.refunds_done, again.refunds_done) == (0, 1, 0)
    assert recorder.refunds == ["SO-5-1730000000"]  # asked for once after it worked, never repeated
    [entry] = await entries(session, "refund")
    assert (entry.reference, entry.listing_id) == ("SO-5-1730000000", listing.id)


async def test_without_a_paystack_key_the_refund_stays_pending(session, demo_users, recorder, monkeypatch):
    provider = demo_users[Role.provider]
    listing, _ = await link_with(session, provider, "removed", None)
    await pending_refund(session, listing.id, "SO-6-1730000000")
    recorder.refund_error = paystack.PaymentsNotSetUpError()

    result = await owner_fee.run_on(session, NOW)

    assert result.refunds_done == 0 and await entries(session, "refund") == []


# --- the one line it prints ---


async def test_the_job_prints_one_line_with_counts_and_no_names_or_addresses(session, demo_users, capsys):
    provider = demo_users[Role.provider]
    await link_with(session, provider, "approved", NOW - timedelta(days=9))

    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from tests.conftest import TEST_DATABASE_URL

    engine = create_async_engine(TEST_DATABASE_URL)
    try:
        await owner_fee.run_job(async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False), NOW)
    finally:
        await engine.dispose()

    printed = capsys.readouterr().out.strip().splitlines()
    assert printed == ["1 lapsed, 0 ended, 0 reminders sent, 0 refunds done."]
    assert provider.email not in "".join(printed)

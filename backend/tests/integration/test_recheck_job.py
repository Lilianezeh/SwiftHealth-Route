"""The nightly re-check job: `python -m app.jobs.recheck`. Requirements: FR-33, FR-36, FR-38, US-11, NFR-07.
Contract: specs/backend/api-spec.md, section 12 ("Phase 11 rules"). Decisions H4 and H5 in
specs/2026-10-20-reports-queue/requirements.md. The clock is passed in; the email is replaced by a recorder.
"""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.integrations import resend
from app.jobs import recheck
from app.models import AuditEntry, Listing, User
from app.models.base import ListingStatus, Role
from app.services import staff_alert_service
from tests.conftest import TEST_DATABASE_URL
from tests.factories import add_listing

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 10, 7, 0, 0, tzinfo=timezone.utc)


@pytest.fixture
def emails(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, str, str]]:
    """Replaces Resend by a list of (to, subject, body), so no email is ever attempted."""
    sent: list[tuple[str, str, str]] = []

    async def record(to: str, subject: str, body: str, **_: object) -> None:
        sent.append((to, subject, body))

    monkeypatch.setattr(resend, "send_email", record)
    return sent


async def status_of(session: AsyncSession, listing: Listing) -> ListingStatus:
    await session.refresh(listing)
    return listing.status


async def audit_entries(session: AsyncSession) -> list[AuditEntry]:
    return list((await session.exec(select(AuditEntry).order_by(AuditEntry.id))).all())


async def test_an_overdue_published_listing_moves_to_recheck_due_with_an_audit_entry(
    session: AsyncSession, emails: list
) -> None:
    overdue = await add_listing(session, "Overdue Clinic", next_check_due=NOW - timedelta(days=1))
    await session.commit()

    moved = await recheck.run_on(session, NOW)

    assert moved == ["Overdue Clinic"]
    assert await status_of(session, overdue) == ListingStatus.recheck_due
    assert overdue.next_check_due == NOW - timedelta(
        days=1
    )  # the date stays, so the list shows how late it is
    [entry] = await audit_entries(session)
    assert entry.user_id is None
    assert entry.listing_id == overdue.id
    assert entry.action == "recheck"
    assert (entry.field_changed, entry.old_value, entry.new_value) == ("status", "published", "recheck_due")
    assert entry.reference == "nightly-recheck"


async def test_nothing_else_is_touched(session: AsyncSession, emails: list) -> None:
    kept = [
        await add_listing(session, "Due later", next_check_due=NOW + timedelta(days=1)),
        await add_listing(session, "Due exactly now", next_check_due=NOW),
        await add_listing(session, "No date", next_check_due=None),
        await add_listing(
            session, "Old draft", status=ListingStatus.draft, next_check_due=NOW - timedelta(days=9)
        ),
        await add_listing(
            session,
            "Old pending",
            status=ListingStatus.pending_review,
            next_check_due=NOW - timedelta(days=9),
        ),
        await add_listing(
            session, "Old hidden", status=ListingStatus.hidden, next_check_due=NOW - timedelta(days=9)
        ),
        await add_listing(
            session,
            "Already flagged",
            status=ListingStatus.recheck_due,
            next_check_due=NOW - timedelta(days=9),
        ),
    ]
    await session.commit()
    before = [listing.status for listing in kept]

    moved = await recheck.run_on(session, NOW)

    assert moved == []
    assert [await status_of(session, listing) for listing in kept] == before
    assert await audit_entries(session) == []
    assert emails == []


async def test_running_it_again_moves_nothing(session: AsyncSession, emails: list) -> None:
    await add_listing(session, "Overdue Clinic", next_check_due=NOW - timedelta(days=1))
    await session.commit()
    await recheck.run_on(session, NOW)

    second = await recheck.run_on(session, NOW)

    assert second == []
    assert len(await audit_entries(session)) == 1


async def test_active_editors_and_admins_get_one_email_with_the_names_only(
    session: AsyncSession, demo_users: dict[Role, User], emails: list
) -> None:
    await add_listing(session, "Overdue Clinic", next_check_due=NOW - timedelta(days=1))
    await add_listing(session, "Overdue Pharmacy", next_check_due=NOW - timedelta(days=3))
    inactive = demo_users[Role.editor]
    other_editor = User(
        name="Second Editor",
        email="second@demo.example.com",
        phone="+2340000000099",
        password_hash="x",
        role=Role.editor,
    )
    session.add(other_editor)
    inactive.is_active = False
    session.add(inactive)
    await session.commit()

    await recheck.run_on(session, NOW)

    recipients = sorted(to for to, _, _ in emails)
    assert recipients == sorted(["second@demo.example.com", demo_users[Role.admin].email])
    _, subject, body = emails[0]
    assert "2" in subject
    assert "Overdue Clinic" in body
    assert "Overdue Pharmacy" in body
    assert "+234" not in body


async def test_a_long_list_of_names_is_cut_and_says_how_many_more(
    session: AsyncSession, demo_users: dict[Role, User], emails: list
) -> None:
    for number in range(staff_alert_service.MAX_NAMES_IN_EMAIL + 5):
        await add_listing(session, f"Clinic {number:03d}", next_check_due=NOW - timedelta(days=1))
    await session.commit()

    await recheck.run_on(session, NOW)

    body = emails[0][2]
    assert "Clinic 000" in body
    assert f"Clinic {staff_alert_service.MAX_NAMES_IN_EMAIL + 4:03d}" not in body
    assert "and 5 more" in body


async def test_no_email_is_sent_when_nothing_moved(
    session: AsyncSession, demo_users: dict[Role, User], emails: list
) -> None:
    await add_listing(session, "Fine Clinic", next_check_due=NOW + timedelta(days=20))
    await session.commit()

    await recheck.run_on(session, NOW)

    assert emails == []


async def test_a_failed_email_never_undoes_the_moves(
    session: AsyncSession, demo_users: dict[Role, User], monkeypatch: pytest.MonkeyPatch
) -> None:
    overdue = await add_listing(session, "Overdue Clinic", next_check_due=NOW - timedelta(days=1))
    await session.commit()

    async def fail(*_: object, **__: object) -> None:
        raise resend.EmailSendError("Resend answered with HTTP 500.")

    monkeypatch.setattr(resend, "send_email", fail)

    moved = await recheck.run_on(session, NOW)

    assert moved == ["Overdue Clinic"]
    assert await status_of(session, overdue) == ListingStatus.recheck_due


async def test_the_command_prints_how_many_listings_moved(
    session: AsyncSession, emails: list, capsys: pytest.CaptureFixture[str]
) -> None:
    await add_listing(session, "Overdue Clinic", next_check_due=NOW - timedelta(days=1))
    await add_listing(session, "Overdue Pharmacy", next_check_due=NOW - timedelta(days=2))
    await session.commit()
    engine = create_async_engine(TEST_DATABASE_URL)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    await recheck.run_job(factory, NOW)
    await engine.dispose()

    assert capsys.readouterr().out.strip() == "2 listings moved to re-check due."

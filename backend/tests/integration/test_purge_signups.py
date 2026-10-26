"""The nightly clean-up of unfinished sign-ups: `python -m app.jobs.purge_signups`. FR-48, NFR-07.
Decision D8 in specs/2026-10-23-accounts-and-facility-ownership/: an account whose email or phone was
not confirmed within 7 days and that no other row names is deleted; nothing else is, ever. Every name,
address and number here is fictional.
"""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.jobs import purge_signups
from app.models import AuditEntry, Listing, User, UserReport, VerificationCheck
from app.models.base import CheckMethod, CheckResult, ReportReason, Role
from app.repositories import user_repository
from app.services import signup_service
from tests.conftest import TEST_DATABASE_URL
from tests.factories import add_listing

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 10, 20, 1, 0, tzinfo=timezone.utc)


async def sign_up_days_ago(
    session: AsyncSession,
    email: str,
    days: float,
    *,
    email_confirmed: bool = False,
    phone_confirmed: bool = False,
) -> User:
    user = await user_repository.create(
        session,
        name=email,
        email=email,
        phone="+2348030000001",
        password_hash="x",
        role=Role.provider,
        confirmed=False,
    )
    user.created_at = NOW - timedelta(days=days)
    user.email_verified_at = NOW if email_confirmed else None
    user.phone_verified_at = NOW if phone_confirmed else None
    session.add(user)
    await session.commit()
    return user


async def emails(session: AsyncSession) -> set[str]:
    return {user.email for user in (await session.exec(select(User))).all()}


async def test_an_account_unconfirmed_for_more_than_7_days_is_deleted_and_a_younger_one_is_kept(
    session: AsyncSession,
) -> None:
    await sign_up_days_ago(session, "old@example.test", 8)
    await sign_up_days_ago(session, "young@example.test", 6)

    deleted = await signup_service.purge_unconfirmed(session, NOW)

    assert deleted == 1
    assert await emails(session) == {"young@example.test"}


async def test_with_termii_live_an_account_with_only_the_email_confirmed_is_deleted_too_after_7_days(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "termii_api_key", "key-set-for-tests")
    await sign_up_days_ago(session, "half@example.test", 9, email_confirmed=True)

    assert await signup_service.purge_unconfirmed(session, NOW) == 1


async def test_without_termii_an_account_with_the_email_confirmed_is_kept_whatever_its_phone(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """D20: its phone waits for an admin's call, so it is not unfinished (or every owner would be deleted)."""
    monkeypatch.setattr(settings, "termii_api_key", "")
    await sign_up_days_ago(session, "half@example.test", 30, email_confirmed=True)

    assert await signup_service.purge_unconfirmed(session, NOW) == 0
    assert await emails(session) == {"half@example.test"}


async def test_without_termii_an_account_whose_email_was_never_confirmed_is_still_deleted(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "termii_api_key", "")
    await sign_up_days_ago(session, "never@example.test", 8)

    assert await signup_service.purge_unconfirmed(session, NOW) == 1


async def test_a_confirmed_account_is_never_deleted_however_old(
    session: AsyncSession, demo_users: dict[Role, User]
) -> None:
    for user in demo_users.values():  # made by an admin: confirmed from the start
        user.created_at = NOW - timedelta(days=900)
        session.add(user)
    await sign_up_days_ago(session, "done@example.test", 30, email_confirmed=True, phone_confirmed=True)
    await session.commit()

    deleted = await signup_service.purge_unconfirmed(session, NOW)

    assert deleted == 0
    assert len(await emails(session)) == 5


async def test_a_staff_sign_up_waiting_for_approval_is_kept(session: AsyncSession) -> None:
    waiting = await sign_up_days_ago(
        session, "waiting@example.test", 30, email_confirmed=True, phone_confirmed=True
    )
    waiting.approval_status = "pending"
    session.add(waiting)
    await session.commit()

    assert await signup_service.purge_unconfirmed(session, NOW) == 0


async def test_an_old_unconfirmed_account_that_another_row_names_is_kept_so_no_row_breaks(
    session: AsyncSession,
) -> None:
    named_in_audit = await sign_up_days_ago(session, "audit@example.test", 20)
    owner = await sign_up_days_ago(session, "owner@example.test", 20)
    creator = await sign_up_days_ago(session, "creator@example.test", 20)
    resolver = await sign_up_days_ago(session, "resolver@example.test", 20)
    checker = await sign_up_days_ago(session, "checker@example.test", 20)
    free = await sign_up_days_ago(session, "free@example.test", 20)
    session.add(AuditEntry(user_id=named_in_audit.id, listing_id=None, action="update"))
    owned = await add_listing(session, "Owned Clinic")
    owned.owner_id, owned.created_by = owner.id, creator.id
    session.add(owned)
    other = await add_listing(session, "Other Clinic")
    session.add(
        UserReport(listing_id=other.id, reason=ReportReason.other, resolved_by=resolver.id, reporter_key="k")
    )
    session.add(
        VerificationCheck(
            listing_id=other.id,
            staff_id=checker.id,
            method=CheckMethod.call,
            result=CheckResult.passed,
            checked_at=NOW,
        )
    )
    await session.commit()

    deleted = await signup_service.purge_unconfirmed(session, NOW)

    assert deleted == 1
    assert "free@example.test" not in await emails(session) and free.email == "free@example.test"
    assert {
        "audit@example.test",
        "owner@example.test",
        "creator@example.test",
        "resolver@example.test",
        "checker@example.test",
    } <= await emails(session)
    assert (await session.exec(select(Listing))).all()  # the listings are untouched


async def test_a_second_run_finds_nothing(session: AsyncSession) -> None:
    await sign_up_days_ago(session, "old@example.test", 8)

    first = await signup_service.purge_unconfirmed(session, NOW)
    second = await signup_service.purge_unconfirmed(session, NOW)

    assert (first, second) == (1, 0)


async def test_the_command_prints_one_line_with_the_number_and_no_name(
    session: AsyncSession, capsys: pytest.CaptureFixture[str]
) -> None:
    await sign_up_days_ago(session, "old@example.test", 8)
    await sign_up_days_ago(session, "older@example.test", 12)
    engine = create_async_engine(TEST_DATABASE_URL)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    deleted = await purge_signups.run_job(factory, NOW)
    await engine.dispose()

    assert deleted == 2
    assert capsys.readouterr().out.strip() == "2 unfinished sign-up accounts deleted."

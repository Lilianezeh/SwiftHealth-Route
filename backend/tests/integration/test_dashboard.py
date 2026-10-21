"""GET /dashboard/stats, and the `due` filter that its numbers must agree with.
Requirements: US-11, FR-34, FR-33, NFR-06. Contract: specs/backend/api-spec.md, section 10 ("Phase 11 rules").
Decision H6 in specs/2026-10-20-reports-queue/requirements.md. The clock is replaced with a fixed moment.
"""

from collections.abc import Iterator
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment
from app.main import app
from app.models import Listing, User, UserReport, VerificationCheck
from app.models.base import CheckMethod, CheckResult, ListingStatus, ReportReason, ReportStatus, Role
from tests.factories import add_listing
from tests.staff_helpers import bearer_for

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 10, 6, 9, 0, tzinfo=timezone.utc)  # 10:00 in Lagos


@pytest.fixture
def clock() -> Iterator[None]:
    app.dependency_overrides[get_current_moment] = lambda: NOW
    yield
    app.dependency_overrides.pop(get_current_moment, None)


async def get_stats(client: AsyncClient, user: User | None):
    headers = bearer_for(user) if user else {}
    return await client.get("/dashboard/stats", headers=headers)


async def add_check(
    session: AsyncSession, listing: Listing, staff: User, result: CheckResult, checked_at: datetime
) -> None:
    session.add(
        VerificationCheck(
            listing_id=listing.id,
            staff_id=staff.id,
            method=CheckMethod.call,
            result=result,
            checked_at=checked_at,
        )
    )
    await session.commit()


# --- who may use it ---


@pytest.mark.parametrize("role", [Role.editor, Role.admin])
async def test_an_editor_and_an_admin_can_read_the_stats(
    client: AsyncClient, demo_users: dict[Role, User], clock: None, role: Role
) -> None:
    assert (await get_stats(client, demo_users[role])).status_code == 200


@pytest.mark.parametrize("role", [Role.verifier, Role.provider])
async def test_a_verifier_and_a_provider_get_403(
    client: AsyncClient, demo_users: dict[Role, User], clock: None, role: Role
) -> None:
    assert (await get_stats(client, demo_users[role])).status_code == 403


async def test_without_a_token_it_is_401(client: AsyncClient, clock: None) -> None:
    assert (await get_stats(client, None)).status_code == 401


# --- the numbers ---


async def test_an_empty_database_has_all_five_statuses_and_zeros(
    client: AsyncClient, demo_users: dict[Role, User], clock: None
) -> None:
    body = (await get_stats(client, demo_users[Role.editor])).json()

    assert body["listings_by_status"] == {
        "draft": 0,
        "pending_review": 0,
        "published": 0,
        "recheck_due": 0,
        "hidden": 0,
    }
    assert body["rechecks_due_this_week"] == 0
    assert body["overdue_rechecks"] == 0
    assert body["open_reports"] == 0
    assert body["urgent_reports"] == 0
    assert body["featured_active"] == 0
    assert len(body["checks_last_30_days"]) == 30


async def test_listings_are_counted_by_status(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    statuses = [ListingStatus.published] * 3 + [ListingStatus.draft, ListingStatus.hidden]
    for number, status in enumerate(statuses):
        await add_listing(session, f"Place {number}", status=status)
    await session.commit()

    counts = (await get_stats(client, demo_users[Role.editor])).json()["listings_by_status"]

    assert counts == {"draft": 1, "pending_review": 0, "published": 3, "recheck_due": 0, "hidden": 1}


async def test_overdue_and_due_this_week_count_only_published_and_recheck_due_listings(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    await add_listing(session, "Overdue published", next_check_due=NOW - timedelta(days=1))
    await add_listing(
        session, "Overdue flagged", status=ListingStatus.recheck_due, next_check_due=NOW - timedelta(days=9)
    )
    await add_listing(
        session, "Overdue hidden", status=ListingStatus.hidden, next_check_due=NOW - timedelta(days=9)
    )
    await add_listing(
        session, "Overdue draft", status=ListingStatus.draft, next_check_due=NOW - timedelta(days=9)
    )
    await add_listing(session, "Soon", next_check_due=NOW + timedelta(days=6))
    await add_listing(
        session, "Soon hidden", status=ListingStatus.hidden, next_check_due=NOW + timedelta(days=2)
    )
    await add_listing(session, "Later", next_check_due=NOW + timedelta(days=8))
    await add_listing(session, "Never", next_check_due=None)
    await session.commit()

    body = (await get_stats(client, demo_users[Role.editor])).json()

    assert body["overdue_rechecks"] == 2
    assert body["rechecks_due_this_week"] == 1


async def test_the_numbers_equal_the_length_of_their_lists(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    await add_listing(session, "Overdue published", next_check_due=NOW - timedelta(days=1))
    await add_listing(
        session, "Overdue hidden", status=ListingStatus.hidden, next_check_due=NOW - timedelta(days=9)
    )
    await add_listing(session, "Soon", next_check_due=NOW + timedelta(days=6))
    await add_listing(
        session, "Soon draft", status=ListingStatus.draft, next_check_due=NOW + timedelta(days=6)
    )
    await session.commit()
    editor = demo_users[Role.editor]
    stats = (await get_stats(client, editor)).json()

    overdue = (await client.get("/listings", params={"due": "overdue"}, headers=bearer_for(editor))).json()
    this_week = (
        await client.get("/listings", params={"due": "this_week"}, headers=bearer_for(editor))
    ).json()

    assert overdue["total"] == stats["overdue_rechecks"] == 1
    assert this_week["total"] == stats["rechecks_due_this_week"] == 1


async def test_open_and_urgent_reports(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    flagged = await add_listing(session, "Flagged", status=ListingStatus.recheck_due)
    fine = await add_listing(session, "Fine")
    rows = [
        (flagged, ReportReason.not_working, ReportStatus.open),  # urgent
        (flagged, ReportReason.closed, ReportStatus.open),
        (fine, ReportReason.not_working, ReportStatus.open),
        (flagged, ReportReason.not_working, ReportStatus.resolved),  # closed: not counted
    ]
    for listing, reason, status in rows:
        session.add(UserReport(listing_id=listing.id, reason=reason, status=status, created_at=NOW))
    await session.commit()

    body = (await get_stats(client, demo_users[Role.editor])).json()

    assert body["open_reports"] == 3
    assert body["urgent_reports"] == 1


async def test_featured_active_counts_only_a_future_end(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    await add_listing(session, "Featured", featured_until=NOW + timedelta(days=3))
    await add_listing(session, "Ended", featured_until=NOW - timedelta(days=1))
    await add_listing(session, "Never featured")
    await session.commit()

    assert (await get_stats(client, demo_users[Role.editor])).json()["featured_active"] == 1


# --- the chart ---


async def test_checks_are_30_zero_filled_lagos_days_oldest_first_ending_today(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    listing = await add_listing(session, "Night Pharmacy")
    staff = demo_users[Role.verifier]
    await add_check(session, listing, staff, CheckResult.passed, NOW - timedelta(hours=1))
    await add_check(session, listing, staff, CheckResult.passed, NOW - timedelta(hours=2))
    await add_check(session, listing, staff, CheckResult.failed, NOW - timedelta(hours=3))
    await add_check(session, listing, staff, CheckResult.passed, NOW - timedelta(days=2))

    days = (await get_stats(client, demo_users[Role.editor])).json()["checks_last_30_days"]

    assert len(days) == 30
    assert days[0]["date"] == "2026-09-07"
    assert days[-1] == {"date": "2026-10-06", "passed": 2, "failed": 1}
    assert days[-3] == {"date": "2026-10-04", "passed": 1, "failed": 0}
    assert days[-2] == {"date": "2026-10-05", "passed": 0, "failed": 0}
    assert [day["date"] for day in days] == sorted(day["date"] for day in days)


async def test_a_check_late_in_the_evening_in_utc_counts_on_the_next_lagos_day(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    listing = await add_listing(session, "Night Pharmacy")
    # 23:30 UTC on 5 October is 00:30 on 6 October in Lagos (UTC+1).
    await add_check(
        session,
        listing,
        demo_users[Role.verifier],
        CheckResult.passed,
        datetime(2026, 10, 5, 23, 30, tzinfo=timezone.utc),
    )

    days = (await get_stats(client, demo_users[Role.editor])).json()["checks_last_30_days"]

    assert days[-1] == {"date": "2026-10-06", "passed": 1, "failed": 0}
    assert days[-2] == {"date": "2026-10-05", "passed": 0, "failed": 0}


async def test_checks_older_than_30_days_are_not_counted(
    client: AsyncClient, session: AsyncSession, demo_users: dict[Role, User], clock: None
) -> None:
    listing = await add_listing(session, "Night Pharmacy")
    await add_check(session, listing, demo_users[Role.verifier], CheckResult.passed, NOW - timedelta(days=45))

    days = (await get_stats(client, demo_users[Role.editor])).json()["checks_last_30_days"]

    assert sum(day["passed"] + day["failed"] for day in days) == 0

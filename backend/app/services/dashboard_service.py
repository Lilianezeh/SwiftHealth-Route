"""The numbers of the staff dashboard. Requirements: US-11, FR-34, FR-33.
Decision H6 in specs/2026-10-20-reports-queue/requirements.md.

"This week" is the same window as `GET /listings?due=this_week` (staff_listing_service.THIS_WEEK), and
both count the same listings, so a number here always equals the length of its list. Days are Lagos days.
"""

from datetime import datetime, time, timedelta

from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.base import CheckResult, ListingStatus
from app.repositories import dashboard_repository, report_repository
from app.schemas.dashboard import CheckDay, DashboardStats
from app.services.hours import LAGOS_TIME
from app.services.staff_listing_service import THIS_WEEK

CHART_DAYS = 30


async def get_stats(session: AsyncSession, moment: datetime) -> DashboardStats:
    """`moment` is passed in (never read from the clock here), so tests can choose the time."""
    by_status = await dashboard_repository.count_by_status(session)
    open_reports, urgent_reports = await report_repository.count_open(session)
    return DashboardStats(
        listings_by_status={status.value: by_status.get(status, 0) for status in ListingStatus},
        rechecks_due_this_week=await dashboard_repository.count_due_between(
            session, after=moment, before=moment + THIS_WEEK
        ),
        overdue_rechecks=await dashboard_repository.count_due_between(session, after=None, before=moment),
        open_reports=open_reports,
        urgent_reports=urgent_reports,
        checks_last_30_days=await checks_of_the_last_days(session, moment),
        featured_active=await dashboard_repository.count_featured_active(session, moment),
    )


async def checks_of_the_last_days(session: AsyncSession, moment: datetime) -> list[CheckDay]:
    """One entry for each of the last 30 Lagos days (today included), oldest first; zero when no check."""
    today = moment.astimezone(LAGOS_TIME).date()
    first_day = today - timedelta(days=CHART_DAYS - 1)
    counts = await dashboard_repository.checks_per_lagos_day(
        session, datetime.combine(first_day, time.min, tzinfo=LAGOS_TIME)
    )
    days = []
    for offset in range(CHART_DAYS):
        day = first_day + timedelta(days=offset)
        days.append(
            CheckDay(
                date=day,
                passed=counts.get((day, CheckResult.passed), 0),
                failed=counts.get((day, CheckResult.failed), 0),
            )
        )
    return days

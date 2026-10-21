"""The only code that counts for the dashboard. Requirements: US-11, FR-34. Decision H6 in
specs/2026-10-20-reports-queue/requirements.md. Open reports are counted by report_repository.
"""

from datetime import date, datetime

from sqlalchemy import Date, cast, func
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import Listing, VerificationCheck
from app.models.base import CheckResult, ListingStatus
from app.repositories.listing_repository import RECHECK_STATUSES

LAGOS_ZONE = "Africa/Lagos"


async def count_by_status(session: AsyncSession) -> dict[ListingStatus, int]:
    rows = await session.exec(select(Listing.status, func.count()).group_by(Listing.status))
    return {status: count for status, count in rows}


async def count_due_between(session: AsyncSession, *, after: datetime | None, before: datetime) -> int:
    """Published and re-check due listings due before `before` (and from `after`, if given)."""
    conditions = [
        col(Listing.status).in_(RECHECK_STATUSES),
        col(Listing.next_check_due).is_not(None),
        col(Listing.next_check_due) < before,
    ]
    if after is not None:
        conditions.append(col(Listing.next_check_due) >= after)
    return (await session.exec(select(func.count()).select_from(Listing).where(*conditions))).one()


async def count_featured_active(session: AsyncSession, moment: datetime) -> int:
    query = select(func.count()).select_from(Listing).where(col(Listing.featured_until) > moment)
    return (await session.exec(query)).one()


async def checks_per_lagos_day(session: AsyncSession, since: datetime) -> dict[tuple[date, CheckResult], int]:
    """The number of checks from `since` on, for each Lagos calendar day and result."""
    lagos_day = cast(func.timezone(LAGOS_ZONE, VerificationCheck.checked_at), Date)
    rows = await session.exec(
        select(lagos_day, VerificationCheck.result, func.count())
        .where(col(VerificationCheck.checked_at) >= since)
        .group_by(lagos_day, VerificationCheck.result)
    )
    return {(day, result): count for day, result, count in rows}

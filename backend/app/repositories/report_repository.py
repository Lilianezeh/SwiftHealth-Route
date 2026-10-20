"""The only code that writes, reads and counts user reports.
Requirements: US-08, US-12, FR-21, FR-22, FR-35, NFR-07."""

from datetime import datetime

from sqlalchemy import ColumnElement, and_, case, func
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import Listing, UserReport
from app.models.base import ListingStatus, ReportReason, ReportStatus

QueueRow = tuple[UserReport, Listing]


def is_urgent() -> ColumnElement[bool]:
    """An open "not working" report of a listing that is in `recheck_due` (decision H2)."""
    return and_(
        UserReport.status == ReportStatus.open,
        UserReport.reason == ReportReason.not_working,
        Listing.status == ListingStatus.recheck_due,
    )


async def add_report(
    session: AsyncSession,
    *,
    listing_id: int,
    reason: ReportReason,
    comment: str | None,
    reporter_phone: str | None,
    reporter_key: str,
    created_at: datetime,
) -> UserReport:
    """Adds one open report. The caller commits, so it saves together with a flag it may cause."""
    report = UserReport(
        listing_id=listing_id,
        reason=reason,
        comment=comment,
        reporter_phone=reporter_phone,
        reporter_key=reporter_key,
        created_at=created_at,
    )
    session.add(report)
    await session.flush()
    return report


async def count_different_not_working_reporters(
    session: AsyncSession, listing_id: int, *, since: datetime
) -> int:
    """How many different reporters called this listing "not working" since `since` (open, with a key).

    The same rule as the search exclusion (`search_repository.flagged_listing_ids`): FR-22.
    """
    query = select(func.count(func.distinct(UserReport.reporter_key))).where(
        UserReport.listing_id == listing_id,
        UserReport.reason == ReportReason.not_working,
        UserReport.status == ReportStatus.open,
        UserReport.created_at >= since,
        col(UserReport.reporter_key).is_not(None),
    )
    return (await session.exec(query)).one()


async def list_queue(
    session: AsyncSession, *, status: ReportStatus, limit: int, offset: int
) -> tuple[list[QueueRow], int]:
    """One page of reports with their listing, urgent first, then newest first, with the total (FR-35)."""
    condition = UserReport.status == status
    urgent_first = case((is_urgent(), 1), else_=0)
    joined = select(UserReport, Listing).join(Listing, col(Listing.id) == UserReport.listing_id)
    page = await session.exec(
        joined.where(condition)
        .order_by(urgent_first.desc(), col(UserReport.created_at).desc(), col(UserReport.id).desc())
        .offset(offset)
        .limit(limit)
    )
    total = (await session.exec(select(func.count()).select_from(UserReport).where(condition))).one()
    return [(report, listing) for report, listing in page], total


async def get_with_listing(session: AsyncSession, report_id: int) -> QueueRow | None:
    row = (
        await session.exec(
            select(UserReport, Listing)
            .join(Listing, col(Listing.id) == UserReport.listing_id)
            .where(UserReport.id == report_id)
        )
    ).first()
    return (row[0], row[1]) if row else None


async def count_open(session: AsyncSession) -> tuple[int, int]:
    """How many reports are open, and how many of those are urgent."""
    urgent = case((is_urgent(), 1), else_=0)
    row = (
        await session.exec(
            select(func.count(), func.coalesce(func.sum(urgent), 0))
            .select_from(UserReport)
            .join(Listing, col(Listing.id) == UserReport.listing_id)
            .where(UserReport.status == ReportStatus.open)
        )
    ).one()
    return int(row[0]), int(row[1])

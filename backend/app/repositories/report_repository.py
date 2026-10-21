"""The only code that writes and counts user reports. Requirements: US-08, FR-21, FR-22, NFR-07."""

from datetime import datetime

from sqlalchemy import func
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import UserReport
from app.models.base import ReportReason, ReportStatus


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

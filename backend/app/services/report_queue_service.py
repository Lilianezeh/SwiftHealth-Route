"""The staff report queue: list the reports, resolve or dismiss one.
Requirements: US-12, FR-35, FR-38, NFR-07.
Decisions H1 to H3 and H7 in specs/2026-10-20-reports-queue/requirements.md.

Closing a report deletes the reporter's phone and the keyed hash that counted different reporters
(NDPA 2023), and writes an audit entry that holds neither the phone nor the comment.
"""

from datetime import datetime

from sqlmodel.ext.asyncio.session import AsyncSession

from app.integrations.termii import mask_phone
from app.models import Listing, User, UserReport
from app.models.base import ListingStatus, ReportReason, ReportStatus
from app.repositories import audit_repository, report_repository
from app.schemas.report_queue import ReportList, ReportListingRef, ReportQueueParams, ReportRead

CLOSED_MESSAGE = "This report is already closed."


class ReportNotFoundError(Exception):
    """No report has this id."""


class ReportAlreadyClosedError(Exception):
    """The report is already resolved or dismissed."""


def is_urgent(report: UserReport, listing: Listing) -> bool:
    """The same rule as `report_repository.is_urgent`, which orders the queue (decision H2)."""
    return (
        report.status == ReportStatus.open
        and report.reason == ReportReason.not_working
        and listing.status == ListingStatus.recheck_due
    )


def to_read(report: UserReport, listing: Listing) -> ReportRead:
    return ReportRead(
        id=report.id,
        listing=ReportListingRef(
            id=listing.id, slug=listing.slug, name=listing.name, area=listing.area, status=listing.status
        ),
        reason=report.reason,
        comment=report.comment,
        reporter_phone=mask_phone(report.reporter_phone) if report.reporter_phone else None,
        created_at=report.created_at,
        status=report.status,
        urgent=is_urgent(report, listing),
        resolved_at=report.resolved_at,
    )


async def list_reports(session: AsyncSession, params: ReportQueueParams) -> ReportList:
    rows, total = await report_repository.list_queue(
        session, status=params.status, limit=params.limit, offset=params.offset
    )
    return ReportList(items=[to_read(report, listing) for report, listing in rows], total=total)


async def close_report(
    session: AsyncSession, user: User, report_id: int, new_status: ReportStatus, moment: datetime
) -> ReportRead:
    """`moment` is passed in (never read from the clock here), so tests can choose the time."""
    row = await report_repository.get_with_listing(session, report_id)
    if row is None:
        raise ReportNotFoundError
    report, listing = row
    if report.status != ReportStatus.open:
        raise ReportAlreadyClosedError

    report.status = new_status
    report.resolved_by = user.id
    report.resolved_at = moment
    report.reporter_phone = None
    report.reporter_key = None
    session.add(report)
    action = "report_resolve" if new_status == ReportStatus.resolved else "report_dismiss"
    await audit_repository.add_entry(
        session,
        user_id=user.id,
        listing_id=listing.id,
        action=action,
        field_changed="status",
        old_value=ReportStatus.open.value,
        new_value=new_status.value,
        reference=f"report-{report.id}",
        changed_at=moment,
    )
    await session.commit()
    return to_read(report, listing)

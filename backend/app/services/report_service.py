"""A visitor reports a problem; two different "not working" reports in 7 days flag the listing.
Requirements: US-08, FR-20 to FR-22, NFR-07, FR-38. Decisions B1 to B6: specs/2026-10-20-reports/.

The report keeps a keyed hash of the reporter (their phone, else their IP), never the raw IP. The flag
moves a published listing to `recheck_due`, writes an audit entry and returns who must be told; the route
sends the alerts after the answer.
"""

from dataclasses import dataclass
from datetime import datetime

from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.security import hash_reporter_key
from app.models.base import ListingStatus
from app.repositories import audit_repository, listing_repository, report_repository
from app.schemas.report import ReportCreate
from app.services import staff_alert_service
from app.services.search_service import REPORT_WINDOW, REPORTS_TO_EXCLUDE
from app.services.staff_alert_service import StaffAlert

THANK_YOU = "Thank you. We will check this listing."
AUTO_FLAG_REFERENCE = "auto-flag"


class ReportListingNotFoundError(Exception):
    """No published listing has this id. The route answers 404 for unknown and unpublished alike."""


@dataclass(frozen=True)
class ReportOutcome:
    report_id: int
    alert: StaffAlert | None  # set only when this report flagged the listing


async def create_report(
    session: AsyncSession, payload: ReportCreate, client_ip: str, moment: datetime
) -> ReportOutcome:
    """`moment` is passed in (never read from the clock here), so tests can choose the time."""
    listing = await listing_repository.get_by_id(session, payload.listing_id)
    if listing is None or listing.status != ListingStatus.published:
        raise ReportListingNotFoundError

    reporter_key = hash_reporter_key(payload.reporter_phone or client_ip)
    report = await report_repository.add_report(
        session,
        listing_id=listing.id,
        reason=payload.reason,
        comment=payload.comment,
        reporter_phone=payload.reporter_phone,
        reporter_key=reporter_key,
        created_at=moment,
    )

    alert = None
    if payload.reason.value == "not_working":
        reporters = await report_repository.count_different_not_working_reporters(
            session, listing.id, since=moment - REPORT_WINDOW
        )
        if reporters >= REPORTS_TO_EXCLUDE:  # FR-22: the same count that hides a listing from search
            listing.status = ListingStatus.recheck_due
            listing.next_check_due = moment  # urgent: first in the re-check queue (decision B5)
            listing.updated_at = moment
            session.add(listing)
            await audit_repository.add_entry(
                session,
                user_id=None,
                listing_id=listing.id,
                action="flag",
                field_changed="status",
                old_value=ListingStatus.published.value,
                new_value=ListingStatus.recheck_due.value,
                reference=AUTO_FLAG_REFERENCE,
                changed_at=moment,
            )
            alert = await staff_alert_service.load_alert(session, listing.name)

    await session.commit()
    return ReportOutcome(report_id=report.id, alert=alert)

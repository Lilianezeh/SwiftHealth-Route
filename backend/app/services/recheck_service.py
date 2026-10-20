"""The nightly re-check: a published listing that is past its check date goes to `recheck_due`.
Requirements: FR-33, FR-36, FR-38, US-11.
Decision H5 in specs/2026-10-20-reports-queue/requirements.md.

`recheck_due` hides the listing from the public (the trust rules). Until this runs, an overdue listing
stays visible with `verification_due: true`. The check date is left as it is, so the re-check list
shows how late a listing is.
"""

from datetime import datetime

from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.base import ListingStatus
from app.repositories import audit_repository, listing_repository

NIGHTLY_REFERENCE = "nightly-recheck"


async def move_overdue_to_recheck(session: AsyncSession, moment: datetime) -> list[str]:
    """Moves every overdue published listing, writes one audit entry each, commits, and returns the names.

    `moment` is passed in (never read from the clock here), so tests can choose the time.
    """
    listings = await listing_repository.find_overdue_published(session, moment)
    for listing in listings:
        listing.status = ListingStatus.recheck_due
        listing.updated_at = moment
        session.add(listing)
        await audit_repository.add_entry(
            session,
            user_id=None,
            listing_id=listing.id,
            action="recheck",
            field_changed="status",
            old_value=ListingStatus.published.value,
            new_value=ListingStatus.recheck_due.value,
            reference=NIGHTLY_REFERENCE,
            changed_at=moment,
        )
    await session.commit()
    return [listing.name for listing in listings]

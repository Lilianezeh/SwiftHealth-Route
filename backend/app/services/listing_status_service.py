"""Moving a listing between the five statuses. Requirements: FR-32, FR-33, FR-38, NFR-06.
The table of statuses is in specs/prd.md. Decisions C3 and C4 in specs/2026-10-20-staff-screens/.

The route checks the role (editor or admin for publish, hide and reopen); a verifier's right to submit
only their own draft is `access_service`. Every move writes an audit entry and is one transaction.
No HTTP here.
"""

from datetime import datetime, timedelta

from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import Listing, User
from app.models.base import CheckMethod, ListingStatus
from app.repositories import audit_repository, category_repository, verification_repository

PUBLISH_CHECK_WINDOW = timedelta(days=14)  # api-spec: a passing check in the last 14 days


class InvalidMoveError(Exception):
    """The move is not in the table of statuses, or a rule for it is not met. The route answers 400."""


async def _move(
    session: AsyncSession,
    user: User,
    listing: Listing,
    new_status: ListingStatus,
    action: str,
    moment: datetime,
    reference: str | None = None,
) -> None:
    old_status = listing.status
    listing.status = new_status
    listing.updated_at = moment
    session.add(listing)
    await audit_repository.add_entry(
        session,
        user_id=user.id,
        listing_id=listing.id,
        action=action,
        field_changed="status",
        old_value=old_status.value,
        new_value=new_status.value,
        reference=reference,
        changed_at=moment,
    )


async def submit(session: AsyncSession, user: User, listing: Listing, moment: datetime) -> None:
    """Draft to pending review; needs a passing call and a passing visit."""
    if listing.status != ListingStatus.draft:
        raise InvalidMoveError("Only a draft can be submitted for review.")
    for method in (CheckMethod.call, CheckMethod.visit):
        if not await verification_repository.has_passing_check(session, listing.id, method):
            raise InvalidMoveError("Submit needs a passing call and a passing visit first.")
    await _move(session, user, listing, ListingStatus.pending_review, "submit", moment)
    await session.commit()


async def publish(session: AsyncSession, user: User, listing: Listing, moment: datetime) -> None:
    """Pending review or re-check due to published; needs a passing check in the last 14 days (FR-33)."""
    if listing.status not in (ListingStatus.pending_review, ListingStatus.recheck_due):
        raise InvalidMoveError(
            "Only a listing that is pending review or due for a re-check can be published."
        )
    verified_at = await verification_repository.newest_passing_check_time(
        session, listing.id, since=moment - PUBLISH_CHECK_WINDOW
    )
    if verified_at is None:
        raise InvalidMoveError("Publish needs a passing check in the last 14 days.")
    category = await category_repository.get_by_id(session, listing.category_id)
    listing.last_verified_at = verified_at
    listing.next_check_due = moment + timedelta(days=category.recheck_days)
    await _move(session, user, listing, ListingStatus.published, "publish", moment)
    await session.commit()


async def hide(session: AsyncSession, user: User, listing: Listing, reason: str, moment: datetime) -> None:
    """Any other status to hidden. The reason is kept in the audit entry's `reference` (decision C4)."""
    if listing.status == ListingStatus.hidden:
        raise InvalidMoveError("This listing is already hidden.")
    await _move(session, user, listing, ListingStatus.hidden, "hide", moment, reference=reason)
    await session.commit()


async def reopen(session: AsyncSession, user: User, listing: Listing, moment: datetime) -> None:
    """Hidden to draft, so it can be checked again."""
    if listing.status != ListingStatus.hidden:
        raise InvalidMoveError("Only a hidden listing can be reopened.")
    await _move(session, user, listing, ListingStatus.draft, "reopen", moment)
    await session.commit()

"""Verification checks: log a call or visit and read the history.
Requirements: FR-32, US-10, FR-36, FR-38. Decisions C3 and C9 in specs/2026-10-20-staff-screens/.

A passing visit with a photo sets the entrance photo. A passing check marks the primary phone as
working. A failed check of a published listing hides it and returns an alert for the editors (FR-36);
the route sends it after the answer.
"""

from dataclasses import dataclass
from datetime import datetime

from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import Listing, User
from app.models.base import CheckMethod, CheckResult, ListingStatus
from app.repositories import audit_repository, listing_repository, verification_repository
from app.schemas.verification import CheckCreate, CheckList, CheckRead
from app.services import staff_alert_service
from app.services.staff_alert_service import StaffAlert

FAILED_RECHECK_REFERENCE = "failed re-check"


class ListingNotFoundError(Exception):
    """No listing has this id."""


@dataclass(frozen=True)
class CheckOutcome:
    check: CheckRead
    alert: StaffAlert | None  # set only when this check hid a published listing


def to_read(check, staff_name: str) -> CheckRead:
    return CheckRead(
        id=check.id,
        method=check.method,
        result=check.result,
        person_reached=check.person_reached,
        notes=check.notes,
        photo_url=check.photo_url,
        checked_at=check.checked_at,
        staff_id=check.staff_id,
        staff_name=staff_name,
    )


async def log_check(
    session: AsyncSession, user: User, listing_id: int, payload: CheckCreate, moment: datetime
) -> CheckOutcome:
    """`moment` is passed in (never read from the clock here), so tests can choose the time."""
    listing: Listing | None = await listing_repository.get_by_id(session, listing_id)
    if listing is None:
        raise ListingNotFoundError(listing_id)

    check = await verification_repository.add_check(
        session,
        listing_id=listing.id,
        staff_id=user.id,
        method=payload.method,
        result=payload.result,
        person_reached=payload.person_reached,
        notes=payload.notes,
        photo_url=payload.photo_url,
        checked_at=moment,
    )
    await audit_repository.add_entry(
        session,
        user_id=user.id,
        listing_id=listing.id,
        action="check",
        field_changed="check",
        new_value=f"{payload.method.value}: {payload.result.value}",
        changed_at=moment,
    )

    alert = None
    if payload.result == CheckResult.passed:
        await listing_repository.mark_primary_phone_working(session, listing.id, moment)
        if payload.method == CheckMethod.visit and payload.photo_url:
            old_photo = listing.entrance_photo_url
            listing.entrance_photo_url = payload.photo_url
            listing.updated_at = moment
            session.add(listing)
            await audit_repository.add_entry(
                session,
                user_id=user.id,
                listing_id=listing.id,
                action="update",
                field_changed="entrance_photo_url",
                old_value=old_photo,
                new_value=payload.photo_url,
                changed_at=moment,
            )
    elif listing.status == ListingStatus.published:  # FR-36: a failed re-check hides it at once
        listing.status = ListingStatus.hidden
        listing.updated_at = moment
        session.add(listing)
        await audit_repository.add_entry(
            session,
            user_id=user.id,
            listing_id=listing.id,
            action="hide",
            field_changed="status",
            old_value=ListingStatus.published.value,
            new_value=ListingStatus.hidden.value,
            reference=FAILED_RECHECK_REFERENCE,
            changed_at=moment,
        )
        alert = await staff_alert_service.load_failed_check_alert(session, listing.name)

    await session.commit()
    return CheckOutcome(check=to_read(check, user.name), alert=alert)


async def list_checks(session: AsyncSession, listing_id: int) -> CheckList:
    if await listing_repository.get_by_id(session, listing_id) is None:
        raise ListingNotFoundError(listing_id)
    rows = await verification_repository.list_with_staff_names(session, listing_id)
    return CheckList(items=[to_read(check, name) for check, name in rows], total=len(rows))

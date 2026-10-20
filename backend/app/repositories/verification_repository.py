"""The only code that reads and writes verification checks. Requirements: FR-32, US-10, FR-33."""

from datetime import datetime

from sqlalchemy import func
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import Listing, User, VerificationCheck
from app.models.base import CheckMethod, CheckResult


async def add_check(
    session: AsyncSession,
    *,
    listing_id: int,
    staff_id: int,
    method: CheckMethod,
    result: CheckResult,
    person_reached: str | None,
    notes: str | None,
    photo_url: str | None,
    checked_at: datetime,
) -> VerificationCheck:
    """Adds one check. The caller commits, so it saves together with the changes it causes."""
    check = VerificationCheck(
        listing_id=listing_id,
        staff_id=staff_id,
        method=method,
        result=result,
        person_reached=person_reached,
        notes=notes,
        photo_url=photo_url,
        checked_at=checked_at,
    )
    session.add(check)
    await session.flush()
    return check


async def list_with_staff_names(
    session: AsyncSession, listing_id: int
) -> list[tuple[VerificationCheck, str]]:
    """Every check of a listing with the name of who made it, newest first."""
    query = (
        select(VerificationCheck, User.name)
        .join(User, col(User.id) == VerificationCheck.staff_id)
        .where(VerificationCheck.listing_id == listing_id)
        .order_by(col(VerificationCheck.checked_at).desc(), col(VerificationCheck.id).desc())
    )
    return [(check, name) for check, name in (await session.exec(query)).all()]


async def has_passing_check(session: AsyncSession, listing_id: int, method: CheckMethod) -> bool:
    query = select(func.count()).where(
        VerificationCheck.listing_id == listing_id,
        VerificationCheck.method == method,
        VerificationCheck.result == CheckResult.passed,
    )
    return (await session.exec(query)).one() > 0


async def newest_passing_check_time(
    session: AsyncSession, listing_id: int, *, since: datetime
) -> datetime | None:
    """When the newest passing check since `since` was made, or None if there is none."""
    query = select(func.max(VerificationCheck.checked_at)).where(
        VerificationCheck.listing_id == listing_id,
        VerificationCheck.result == CheckResult.passed,
        VerificationCheck.checked_at >= since,
    )
    return (await session.exec(query)).one()


async def list_all_for_export(session: AsyncSession) -> list[tuple[VerificationCheck, str, str]]:
    """Every check with the listing's name and the staff member's name, oldest first (CSV export)."""
    query = (
        select(VerificationCheck, Listing.name, User.name)
        .join(Listing, col(Listing.id) == VerificationCheck.listing_id)
        .join(User, col(User.id) == VerificationCheck.staff_id)
        .order_by(col(VerificationCheck.checked_at), col(VerificationCheck.id))
    )
    rows = (await session.exec(query)).all()
    return [(check, listing_name, staff_name) for check, listing_name, staff_name in rows]

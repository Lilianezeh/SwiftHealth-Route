from datetime import datetime

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import Listing, OpeningHours, PhoneNumber, Service, VerificationCheck
from app.models.base import CheckMethod, CheckResult


async def get_by_id(session: AsyncSession, listing_id: int) -> Listing | None:
    return await session.get(Listing, listing_id)


async def get_by_slug(session: AsyncSession, slug: str) -> Listing | None:
    return (await session.exec(select(Listing).where(Listing.slug == slug))).first()


async def add_listing_with_details(
    session: AsyncSession,
    listing: Listing,
    phones: list[PhoneNumber],
    opening_hours: list[OpeningHours],
    services: list[Service],
) -> Listing:
    """Adds a listing and its phones, hours and services together. The caller commits."""
    session.add(listing)
    await session.flush()  # gives the listing an id for the child rows
    for child in (*phones, *opening_hours, *services):
        child.listing_id = listing.id
        session.add(child)
    await session.flush()
    return listing


async def add_verification_check(
    session: AsyncSession,
    *,
    listing_id: int,
    staff_id: int,
    method: CheckMethod,
    result: CheckResult,
    person_reached: str | None,
    notes: str | None,
    checked_at: datetime,
) -> VerificationCheck:
    check = VerificationCheck(
        listing_id=listing_id, staff_id=staff_id, method=method, result=result,
        person_reached=person_reached, notes=notes, checked_at=checked_at,
    )
    session.add(check)
    await session.flush()
    return check

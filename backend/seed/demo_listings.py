"""Put the demo listings into the database, or take them out again. Requirements: US-01, FR-04.

Runs when the container starts (see backend/Dockerfile) and does nothing unless a flag is exactly "true":
- SEED_DEMO_LISTINGS=true    adds the listings in seed/demo_listings_data.py (safe to repeat).
- REMOVE_DEMO_LISTINGS=true  deletes exactly those listings by their fixed slugs. Both true: it removes.
Listings only: no user is created and no password is read. A failure is logged and never stops the API.
Decision 13 in specs/2026-10-09-search-backend/requirements.md. Local run:
docker compose exec -e SEED_DEMO_LISTINGS=true backend python -m seed.demo_listings
"""
import asyncio
import logging
import os
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import engine, session_factory
from app.models import Listing, OpeningHours, PhoneNumber, Service
from app.models.base import utcnow
from app.repositories import audit_repository, category_repository, listing_repository
from seed.demo_listings_data import DEMO_LISTING_SLUGS, DEMO_LISTINGS
from seed.seed_data import CATEGORIES

SEED_FLAG = "SEED_DEMO_LISTINGS"
REMOVE_FLAG = "REMOVE_DEMO_LISTINGS"
VERIFIED_DAYS_AGO = 3  # demo listings look freshly verified, so they are not shown as overdue
logger = logging.getLogger("seed.demo_listings")


@dataclass(frozen=True)
class FlagResult:
    action: str  # "seeded", "removed" or "nothing"
    counts: dict[str, int]


def flag_is_on(environment: Mapping[str, str], name: str) -> bool:
    """Only the exact text "true" counts. "True", "1", "yes" and an empty value are all off."""
    return environment.get(name) == "true"


async def seed_demo_listings(session: AsyncSession, now: datetime) -> dict[str, int]:
    """Adds whatever is missing and returns how many categories and listings were created."""
    created = {"categories": 0, "listings": 0}
    categories = {}
    needed_slugs = {listing.category_slug for listing in DEMO_LISTINGS}
    for category_seed in (category for category in CATEGORIES if category.slug in needed_slugs):
        category = await category_repository.get_by_slug(session, category_seed.slug)
        if category is None:
            category = await category_repository.create(
                session, name=category_seed.name, slug=category_seed.slug,
                is_emergency=category_seed.is_emergency, recheck_days=category_seed.recheck_days,
            )
            created["categories"] += 1
        categories[category_seed.slug] = category

    for seed in DEMO_LISTINGS:
        if await listing_repository.get_by_slug(session, seed.slug) is not None:
            continue  # already there: keep it as it is
        category = categories[seed.category_slug]
        last_verified_at = now - timedelta(days=VERIFIED_DAYS_AGO)
        listing = Listing(
            slug=seed.slug, name=seed.name, category_id=category.id, area=seed.area, address=seed.address,
            landmark=seed.landmark, latitude=seed.latitude, longitude=seed.longitude,
            description=seed.description, status=seed.status, is_24_hours=seed.is_24_hours,
            last_verified_at=last_verified_at,
            next_check_due=last_verified_at + timedelta(days=category.recheck_days),
        )  # no owner and no creator: there is no user
        phones = [
            PhoneNumber(number=phone.number, label=phone.label, is_primary=phone.is_primary,
                        last_working_at=last_verified_at)
            for phone in seed.phones
        ]
        opening_hours = [
            OpeningHours(day_of_week=hours.day_of_week, opens_at=hours.opens_at, closes_at=hours.closes_at,
                         is_closed=hours.is_closed)
            for hours in seed.opening_hours
        ]
        services = [Service(name=service.name) for service in seed.services]
        await listing_repository.add_listing_with_details(session, listing, phones, opening_hours, services)
        await audit_repository.add_entry(
            session, user_id=None, listing_id=listing.id, action="create", reference="demo-seed"
        )
        created["listings"] += 1
    await session.commit()
    return created


async def remove_demo_listings(session: AsyncSession) -> dict[str, int]:
    """Deletes exactly the listings with the fixed demo slugs, and their rows, in one transaction."""
    try:
        deleted = await listing_repository.delete_by_slugs(session, DEMO_LISTING_SLUGS)
        await session.commit()
    except Exception:
        await session.rollback()  # all or nothing
        raise
    return deleted


async def count_demo_listings(session: AsyncSession) -> int:
    """How many listings with the fixed demo slugs are left. The launch check wants zero."""
    return await listing_repository.count_by_slugs(session, DEMO_LISTING_SLUGS)


async def apply_flags(session: AsyncSession, environment: Mapping[str, str], now: datetime) -> FlagResult:
    if flag_is_on(environment, REMOVE_FLAG):  # the removal wins when both flags are on
        return FlagResult("removed", await remove_demo_listings(session))
    if flag_is_on(environment, SEED_FLAG):
        return FlagResult("seeded", await seed_demo_listings(session, now))
    return FlagResult("nothing", {})


async def main(environment: Mapping[str, str] = os.environ) -> None:
    """Never raises: a problem here must not keep the API from starting."""
    if not (flag_is_on(environment, SEED_FLAG) or flag_is_on(environment, REMOVE_FLAG)):
        logger.info("Demo listings: no flag set, nothing to do.")
        return
    try:
        async with session_factory() as session:
            result = await apply_flags(session, environment, utcnow())
            left = await count_demo_listings(session)
        logger.info("Demo listings %s: %s. Demo listings left: %d.", result.action, result.counts, left)
    except Exception:
        logger.exception("Demo listings step failed. The API will start without it.")
    finally:
        await engine.dispose()  # asyncio.run closes the event loop, so close the connections first


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    asyncio.run(main())

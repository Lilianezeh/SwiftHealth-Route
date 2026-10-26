"""A clearly fictional listing for looking at the listing page locally.
Requirements: FR-47, FR-22, FR-09, US-06, NFR-07.

Spec: specs/2026-10-13-listing-page/requirements.md D11. Run (development only):
    docker compose exec backend python -m seed.whatsapp_fixture

It adds ONE listing, "TEST FIXTURE (fictional): WhatsApp demo clinic" (slug test-fixture-whatsapp-clinic), so
the owner can open /listing/test-fixture-whatsapp-clinic and see: a WhatsApp button on the primary number, one
other number without it and one with it, fees of every kind, a shift past midnight, a closed day, an entrance
photo and the "recently reported as not working" note (two different reporters in the last 7 days). Adding it
twice changes nothing.

- It is NOT part of `seed.seed` or of the production demo listings (`seed.demo_listings`), which keep
  `is_whatsapp` false everywhere (decision 10 in specs/2026-10-11-listing-detail-api/requirements.md: a
  fictional number could belong to a real person). These numbers are the impossible form, +234 then a zero,
  which can never be a real number, so a wa.me link cannot reach a real person. WhatsApp will say the number
  is not on WhatsApp: that is expected.
- It refuses to run unless APP_ENV is "development" (the default); production sets APP_ENV=production
  (render.yaml).
- It touches no other row and adds no table.
"""
import asyncio
import logging
import os
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.database import engine, session_factory
from app.models import Listing, OpeningHours, PhoneNumber, Service, UserReport
from app.models.base import ListingStatus, ReportReason, ReportStatus, utcnow
from app.repositories import audit_repository, category_repository, listing_repository, report_repository
from seed.seed_data import AREA_CENTRES, CATEGORIES, HoursSeed, ServiceSeed, demo_phone

logger = logging.getLogger("seed.whatsapp_fixture")

FIXTURE_NAME = "TEST FIXTURE (fictional): WhatsApp demo clinic"
FIXTURE_SLUG = "test-fixture-whatsapp-clinic"
FIXTURE_DESCRIPTION = (
    "Fictional test fixture: not a real facility. "
    "It exists only to try the listing page on a developer's machine."
)
FIXTURE_PHOTO_URL = "https://placehold.co/640x360/png?text=Test+fixture"  # a neutral placeholder picture
FIXTURE_AREA = "GRA"
FIXTURE_VERIFIED_DAYS_AGO = 3
FIXTURE_REPORT_DAYS_AGO = 1
# Two different reporters, so the listing counts as "recently reported as not working" (FR-22).
FIXTURE_REPORTER_KEYS = ("whatsapp-fixture-reporter-1", "whatsapp-fixture-reporter-2")
FIXTURE_FEES_COLLECTED_ON = date(2026, 9, 28)


@dataclass(frozen=True)
class FixturePhone:
    number: str
    label: str
    is_primary: bool
    is_whatsapp: bool


# Numbers 951 to 953: the main seed uses 1 to 30, 101 to 130 and 901 to 904; the demo listings 801 to 804.
FIXTURE_PHONES: tuple[FixturePhone, ...] = (
    FixturePhone(demo_phone(951), "Front desk", is_primary=True, is_whatsapp=True),  # Call and WhatsApp
    FixturePhone(demo_phone(952), "Reception", is_primary=False, is_whatsapp=False),  # Call only
    FixturePhone(demo_phone(953), "Emergency", is_primary=False, is_whatsapp=True),  # Call and WhatsApp
)

FIXTURE_HOURS: tuple[HoursSeed, ...] = (
    *(HoursSeed(day, time(8, 0), time(17, 0), False) for day in range(4)),  # Monday to Thursday
    HoursSeed(4, time(20, 0), time(2, 0), False),  # Friday night, past midnight ("next day")
    HoursSeed(5, time(9, 0), time(13, 0), False),  # Saturday morning
    HoursSeed(6, None, None, True),  # Sunday: closed
)

FIXTURE_SERVICES: tuple[ServiceSeed, ...] = (
    # A range, with a date.
    ServiceSeed("Consultation", Decimal("1500.00"), Decimal("3000.00"), FIXTURE_FEES_COLLECTED_ON),
    ServiceSeed("Blood pressure check", Decimal("500.00"), Decimal("500.00"), None),  # one amount, no date
    ServiceSeed("Malaria test", Decimal("1000.00"), None, None),  # a minimum only
    ServiceSeed("Home visit", None, None, None),  # no fee
)


def environment_allows(environment: Mapping[str, str]) -> bool:
    """Only development, the setting's own default when APP_ENV is not set. Production is refused, and so is
    anything else."""
    return environment.get("APP_ENV", "development") == "development"


async def seed_whatsapp_fixture(session: AsyncSession, now: datetime) -> dict[str, int]:
    """Adds the fixture listing if missing ({"listings": 1}); if it is already there, {"listings": 0}.

    A listing that is already there is kept as it is, except for the dates of its two reports:
    the "recently reported" note needs them in the last 7 days (FR-22), so they are renewed to
    one day ago each time the command runs."""
    existing = await listing_repository.get_by_slug(session, FIXTURE_SLUG)
    if existing is not None:
        reports_date = now - timedelta(days=FIXTURE_REPORT_DAYS_AGO)
        await report_repository.set_dates_for_listing(session, existing.id, reports_date)
        await session.commit()
        return {"listings": 0}

    category_seed = next(category for category in CATEGORIES if category.slug == "clinic")
    category = await category_repository.get_by_slug(session, category_seed.slug)
    if category is None:
        category = await category_repository.create(
            session, name=category_seed.name, slug=category_seed.slug,
            is_emergency=category_seed.is_emergency, recheck_days=category_seed.recheck_days,
        )

    centre_latitude, centre_longitude = AREA_CENTRES[FIXTURE_AREA]
    last_verified_at = now - timedelta(days=FIXTURE_VERIFIED_DAYS_AGO)
    listing = Listing(
        slug=FIXTURE_SLUG, name=FIXTURE_NAME, category_id=category.id, area=FIXTURE_AREA,
        address="951 Example Road", landmark="Fictional landmark: near the example junction",
        latitude=round(centre_latitude + 0.0015, 4), longitude=round(centre_longitude + 0.0015, 4),
        description=FIXTURE_DESCRIPTION, entrance_photo_url=FIXTURE_PHOTO_URL,
        status=ListingStatus.published, is_24_hours=False, last_verified_at=last_verified_at,
        next_check_due=last_verified_at + timedelta(days=category.recheck_days),
    )  # no owner and no creator: there is no user
    phones = [
        PhoneNumber(number=phone.number, label=phone.label, is_primary=phone.is_primary,
                    is_whatsapp=phone.is_whatsapp, last_working_at=last_verified_at)
        for phone in FIXTURE_PHONES
    ]
    opening_hours = [
        OpeningHours(day_of_week=hours.day_of_week, opens_at=hours.opens_at, closes_at=hours.closes_at,
                     is_closed=hours.is_closed)
        for hours in FIXTURE_HOURS
    ]
    services = [
        Service(name=service.name, fee_min_naira=service.fee_min_naira, fee_max_naira=service.fee_max_naira,
                fee_collected_at=service.collected_at)
        for service in FIXTURE_SERVICES
    ]
    await listing_repository.add_listing_with_details(session, listing, phones, opening_hours, services)
    for reporter_key in FIXTURE_REPORTER_KEYS:  # two reporters in the last 7 days: "recently reported"
        session.add(UserReport(
            listing_id=listing.id, reason=ReportReason.not_working, status=ReportStatus.open,
            reporter_key=reporter_key, created_at=now - timedelta(days=FIXTURE_REPORT_DAYS_AGO),
        ))
    await audit_repository.add_entry(
        session, user_id=None, listing_id=listing.id, action="create", reference="whatsapp-fixture"
    )
    await session.commit()
    return {"listings": 1}


async def main(environment: Mapping[str, str] = os.environ) -> int:
    """The exit code: 0 when it ran (or the listing was already there), 1 when it refused or failed."""
    if not environment_allows(environment):
        logger.error(
            "The WhatsApp fixture runs only in development (APP_ENV is %r). Nothing was changed.",
            environment.get("APP_ENV"),
        )
        return 1
    try:
        async with session_factory() as session:
            created = await seed_whatsapp_fixture(session, utcnow())
        logger.info("WhatsApp fixture: %s. Open /listing/%s", created, FIXTURE_SLUG)
        return 0
    except Exception:
        logger.exception("The WhatsApp fixture failed.")
        return 1
    finally:
        await engine.dispose()  # asyncio.run closes the event loop, so close the connections first


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    raise SystemExit(asyncio.run(main()))

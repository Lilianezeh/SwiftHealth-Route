"""The demo listings for the production database. Everything here is fictional, and nothing here is a user.

Why they exist: the production database blocks outside connections and the free Render plan has no shell,
so the only way to put a few listings there is code that runs when the container starts (decision 13 in
specs/2026-10-09-search-backend/requirements.md). Names start with "DEMO – ", slugs are fixed, and the cleanup
deletes by those exact slugs, never by name.
Requirement IDs: US-01 and FR-04 (something for the live search check to find).
"""
from seed.seed_data import ALL_DAY, SUNDAY, ListingSeed, build_listing, plain_service, weekly_hours

DEMO_NAME_PREFIX = "DEMO – "  # an en dash: the cleanup never matches by this, it is only for people reading

# Numbers 801 and up make the phone numbers (+2340000000801...), which the main seed (1 to 30, 101 to 130 and
# 901 to 904) does not use. A zero straight after +234 means these can never be real numbers.
DEMO_LISTINGS: tuple[ListingSeed, ...] = (
    build_listing(
        801, f"{DEMO_NAME_PREFIX}After Hours Pharmacy", "pharmacy", "New Haven",
        weekly_hours("20:00", "02:00"), (plain_service("Prescription filling"),),
    ),
    build_listing(
        802, f"{DEMO_NAME_PREFIX}Day Clinic", "clinic", "GRA", weekly_hours("08:00", "20:00"),
        (plain_service("Consultation"), plain_service("Malaria test")),
    ),
    build_listing(
        803, f"{DEMO_NAME_PREFIX}Always Open Pharmacy", "pharmacy", "Ogui", ALL_DAY,
        (plain_service("Prescription filling"),), is_24_hours=True,
    ),
    build_listing(
        804, f"{DEMO_NAME_PREFIX}Diagnostic Laboratory", "laboratory", "Uwani",
        weekly_hours("08:00", "17:00", closed_days=(SUNDAY,)),
        (plain_service("X-ray"), plain_service("Ultrasound"), plain_service("Blood test")),
    ),
)

# The only rows the cleanup may delete. Read from the listings above, and checked against a written-out
# list in tests/unit/test_demo_listings.py.
DEMO_LISTING_SLUGS: tuple[str, ...] = tuple(listing.slug for listing in DEMO_LISTINGS)

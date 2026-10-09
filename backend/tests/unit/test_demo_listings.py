"""The production demo listings: the data rules.
Requirements: US-01, FR-04 (something to find after the deploy).

Decision 13 in specs/2026-10-09-search-backend/requirements.md. Pure data and flag reading: no database.
"""
import re

import pytest

from seed.demo_listings import REMOVE_FLAG, SEED_FLAG, flag_is_on
from seed.demo_listings_data import DEMO_LISTING_SLUGS, DEMO_LISTINGS, DEMO_NAME_PREFIX
from seed.seed_data import CATEGORIES, LISTINGS, USERS

# Written out on purpose: if a slug changes by accident, the cleanup would miss or hit the wrong rows.
EXPECTED_SLUGS = (
    "demo-after-hours-pharmacy-new-haven",
    "demo-day-clinic-gra",
    "demo-always-open-pharmacy-ogui",
    "demo-diagnostic-laboratory-uwani",
)


def test_every_demo_name_starts_with_demo_dash() -> None:
    assert DEMO_NAME_PREFIX == "DEMO – "  # capital letters, an en dash, and a space
    assert all(listing.name.startswith(DEMO_NAME_PREFIX) for listing in DEMO_LISTINGS)


def test_demo_slugs_are_fixed_unique_and_start_with_demo() -> None:
    assert DEMO_LISTING_SLUGS == EXPECTED_SLUGS
    assert tuple(listing.slug for listing in DEMO_LISTINGS) == EXPECTED_SLUGS
    assert len(set(DEMO_LISTING_SLUGS)) == len(DEMO_LISTING_SLUGS)
    assert all(slug.startswith("demo-") for slug in DEMO_LISTING_SLUGS)


def test_demo_slugs_do_not_clash_with_the_main_seed() -> None:
    # A clash would make the cleanup delete a main seed listing in the development database.
    assert not set(DEMO_LISTING_SLUGS) & {listing.slug for listing in LISTINGS}
    demo_names = {listing.name.lower() for listing in DEMO_LISTINGS}
    assert not demo_names & {listing.name.lower() for listing in LISTINGS}


def test_demo_phones_are_fictional() -> None:
    main_seed_numbers = {phone.number for listing in LISTINGS for phone in listing.phones}
    main_seed_numbers |= {user.phone for user in USERS}
    for listing in DEMO_LISTINGS:
        assert listing.phones, listing.slug
        for phone in listing.phones:
            assert re.fullmatch(r"\+2340\d{9}", phone.number), phone.number  # +234 then a zero: never real
            assert phone.number not in main_seed_numbers


def test_demo_data_has_no_user_or_password() -> None:
    assert all(not listing.owned_by_provider for listing in DEMO_LISTINGS)
    import seed.demo_listings_data as demo_listings_data

    assert not any("password" in name.lower() or "user" in name.lower() for name in vars(demo_listings_data))


def test_demo_listings_are_published_and_verified() -> None:
    for listing in DEMO_LISTINGS:
        assert listing.status.value == "published"
        assert listing.verified_days_ago is not None


def test_every_demo_category_is_in_the_real_category_list() -> None:
    real_category_slugs = {category.slug for category in CATEGORIES}
    assert {listing.category_slug for listing in DEMO_LISTINGS} <= real_category_slugs


def test_demo_listings_cover_a_pharmacy_open_late_and_a_24_hour_one() -> None:
    pharmacies = [listing for listing in DEMO_LISTINGS if listing.category_slug == "pharmacy"]
    assert any(listing.is_24_hours for listing in pharmacies)
    assert any(
        hours.closes_at < hours.opens_at
        for listing in pharmacies for hours in listing.opening_hours if hours.opens_at and hours.closes_at
    )


@pytest.mark.parametrize("value", ["True", "TRUE", "1", "yes", "on", "false", "", " true", "true ", "tru"])
def test_only_the_exact_value_true_turns_a_flag_on(value: str) -> None:
    assert not flag_is_on({SEED_FLAG: value}, SEED_FLAG)
    assert not flag_is_on({REMOVE_FLAG: value}, REMOVE_FLAG)


def test_true_turns_a_flag_on_and_no_value_means_off() -> None:
    assert flag_is_on({SEED_FLAG: "true"}, SEED_FLAG)
    assert not flag_is_on({}, SEED_FLAG)
    assert not flag_is_on({SEED_FLAG: "true"}, REMOVE_FLAG)  # each flag is read on its own


def test_the_flag_names_are_the_ones_in_the_spec() -> None:
    assert (SEED_FLAG, REMOVE_FLAG) == ("SEED_DEMO_LISTINGS", "REMOVE_DEMO_LISTINGS")

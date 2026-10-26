"""Checks that the demo seed data is valid and that running the seed twice creates no duplicates.

Requirement IDs: FR-15 (categories), FR-27/FR-28 (blood), FR-31 (listing fields), FR-33 (re-check
cycle), FR-38 (audit entry for every listing change), US-01 (past-midnight and 24-hour hours).
"""
import re
from decimal import Decimal

import pytest
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.core.security import hash_password
from app.models import (
    AuditEntry,
    Category,
    FacilityOwner,
    Listing,
    OpeningHours,
    PhoneNumber,
    Service,
    User,
    VerificationCheck,
)
from app.models.base import CheckResult, ListingStatus, Role
from seed.seed import SeedConfigError, read_passwords, run
from seed.seed_data import (
    BLOOD_GROUPS,
    CATEGORIES,
    EMERGENCY_RECHECK_DAYS,
    LISTINGS,
    OTHER_RECHECK_DAYS,
    USERS,
)

TEST_PASSWORDS = {role: f"test-password-for-{role.value}" for role in Role}
PHONE_PATTERN = re.compile(r"^\+234\d{10}$")
# Rough box around Enugu city; demo coordinates must fall inside it.
ENUGU_LATITUDE_RANGE = (6.35, 6.55)
ENUGU_LONGITUDE_RANGE = (7.40, 7.60)

EXPECTED_CATEGORY_SLUGS = {
    "hospital", "clinic", "pharmacy", "maternity", "laboratory",
    "ambulance", "fire", "police", "emergency-unit", "roadside-assistance", "security", "blood-bank",
    "disaster-flooding", "gbv-support", "mental-health-crisis",  # SwiftRescue groups of 2026-10-22
}


def is_past_midnight(hours) -> bool:
    return not hours.is_closed and hours.closes_at < hours.opens_at


async def count_rows(session: AsyncSession, model) -> int:
    return (await session.exec(select(func.count()).select_from(model))).one()


# --- categories (FR-15, FR-33) ---

def test_all_spec_categories_are_present():
    assert {category.slug for category in CATEGORIES} == EXPECTED_CATEGORY_SLUGS


def test_the_three_new_swiftrescue_groups_are_emergency_categories_with_no_listing_and_no_phone():
    # Feature specs/2026-10-22-swiftrescue-groups/: staff add verified contacts later; the seed adds
    # none (owner, point 5).
    new_slugs_in_order = ["disaster-flooding", "gbv-support", "mental-health-crisis"]
    new_rows = [category for category in CATEGORIES if category.slug in new_slugs_in_order]
    assert [category.slug for category in new_rows] == new_slugs_in_order
    assert [category.name for category in new_rows] == [
        "Disaster and flooding", "Sexual and gender-based violence support", "Mental health crisis support",
    ]
    assert all(category.is_emergency for category in new_rows)
    assert [category.slug for category in CATEGORIES[-3:]] == new_slugs_in_order
    assert not [listing for listing in LISTINGS if listing.category_slug in new_slugs_in_order]


def test_the_three_renamed_categories_have_their_new_display_names_and_keep_their_slugs():
    names = {category.slug: category.name for category in CATEGORIES}
    assert names["fire"] == "Fire service"
    assert names["emergency-unit"] == "Hospital emergency (24 hours)"
    assert names["roadside-assistance"] == "Road accidents"


def test_emergency_categories_recheck_every_14_days_and_others_every_45():
    for category in CATEGORIES:
        expected_days = EMERGENCY_RECHECK_DAYS if category.is_emergency else OTHER_RECHECK_DAYS
        assert category.recheck_days == expected_days, category.slug
    assert EMERGENCY_RECHECK_DAYS == 14 and OTHER_RECHECK_DAYS == 45


def test_blood_banks_are_an_emergency_category():
    blood_bank = next(category for category in CATEGORIES if category.slug == "blood-bank")
    assert blood_bank.is_emergency


# --- users ---

def test_one_demo_user_per_role_with_unique_emails():
    assert sorted(user.role.value for user in USERS) == sorted(role.value for role in Role)
    assert len({user.email for user in USERS}) == len(USERS)


def test_missing_or_short_passwords_are_refused_without_echoing_values():
    with pytest.raises(SeedConfigError) as error:
        read_passwords({"SEED_ADMIN_PASSWORD": "short"})
    message = str(error.value)
    for variable in ("SEED_VERIFIER_PASSWORD", "SEED_EDITOR_PASSWORD", "SEED_ADMIN_PASSWORD",
                     "SEED_PROVIDER_PASSWORD"):
        assert variable in message
    assert "short" not in message  # the rejected value must never appear in the error


def test_valid_passwords_are_read_by_role():
    environment = {
        "SEED_VERIFIER_PASSWORD": "verifier-password-1",
        "SEED_EDITOR_PASSWORD": "editor-password-12",
        "SEED_ADMIN_PASSWORD": "admin-password-123",
        "SEED_PROVIDER_PASSWORD": "provider-password-1",
    }
    passwords = read_passwords(environment)
    assert passwords[Role.admin] == "admin-password-123"
    assert set(passwords) == set(Role)


def test_hash_password_does_not_store_plain_text():
    hashed = hash_password("a-long-test-password")
    assert hashed != "a-long-test-password"
    assert hashed.startswith("$argon2")


# --- listings (FR-31) ---

def test_about_thirty_listings_with_unique_slugs():
    assert 28 <= len(LISTINGS) <= 32
    assert len({listing.slug for listing in LISTINGS}) == len(LISTINGS)


def test_listings_use_known_areas_categories_and_enugu_coordinates():
    category_slugs = {category.slug for category in CATEGORIES}
    for listing in LISTINGS:
        assert listing.area in settings.areas, listing.slug
        assert listing.category_slug in category_slugs, listing.slug
        assert ENUGU_LATITUDE_RANGE[0] <= listing.latitude <= ENUGU_LATITUDE_RANGE[1], listing.slug
        assert ENUGU_LONGITUDE_RANGE[0] <= listing.longitude <= ENUGU_LONGITUDE_RANGE[1], listing.slug


def test_every_area_has_at_least_one_listing():
    assert {listing.area for listing in LISTINGS} == set(settings.areas)


def test_demo_data_is_labelled_as_fictional():
    for listing in LISTINGS:
        assert listing.name.startswith("Demo "), listing.slug
        assert listing.description.startswith("Demo data (fictional)"), listing.slug


def test_the_demo_set_covers_every_status_we_need_to_test():
    statuses = {listing.status for listing in LISTINGS}
    assert {ListingStatus.published, ListingStatus.draft, ListingStatus.hidden} <= statuses
    overdue = [listing for listing in LISTINGS
               if listing.status == ListingStatus.published and listing.verified_days_ago is not None
               and listing.verified_days_ago > OTHER_RECHECK_DAYS]
    assert len(overdue) == 1


# --- phones ---

def test_phone_numbers_are_plus_234_with_ten_digits_and_never_repeat():
    numbers = [phone.number for listing in LISTINGS for phone in listing.phones]
    assert all(PHONE_PATTERN.match(number) for number in numbers)
    assert len(set(numbers)) == len(numbers)


def test_demo_numbers_can_never_be_real_nigerian_numbers():
    # Real numbers have a non-zero digit straight after +234; ours are all zeros there.
    for listing in LISTINGS:
        for phone in listing.phones:
            assert phone.number.startswith("+2340"), phone.number


def test_each_listing_has_exactly_one_primary_phone():
    for listing in LISTINGS:
        assert sum(phone.is_primary for phone in listing.phones) == 1, listing.slug


# --- opening hours (US-01) ---

def test_each_listing_has_seven_distinct_days():
    for listing in LISTINGS:
        assert sorted(hours.day_of_week for hours in listing.opening_hours) == list(range(7)), listing.slug


def test_at_least_three_published_pharmacies_open_past_midnight():
    past_midnight = [
        listing for listing in LISTINGS
        if listing.category_slug == "pharmacy" and listing.status == ListingStatus.published
        and any(is_past_midnight(hours) for hours in listing.opening_hours)
    ]
    assert len(past_midnight) >= 3


def test_at_least_two_24_hour_pharmacies_and_the_flag_matches_the_hours():
    twenty_four_hour_pharmacies = [
        listing for listing in LISTINGS if listing.category_slug == "pharmacy" and listing.is_24_hours
    ]
    assert len(twenty_four_hour_pharmacies) >= 2
    for listing in LISTINGS:
        open_all_day = all(
            not hours.is_closed and hours.opens_at.isoformat() == "00:00:00"
            and hours.closes_at.isoformat() == "23:59:00"
            for hours in listing.opening_hours
        )
        assert listing.is_24_hours == open_all_day, listing.slug


# --- services and money (FR-11) ---

def test_fees_are_two_place_decimals_with_a_collection_date():
    fee_count = 0
    for listing in LISTINGS:
        for service in listing.services:
            if service.fee_min_naira is None and service.fee_max_naira is None:
                continue
            fee_count += 1
            for fee in (service.fee_min_naira, service.fee_max_naira):
                assert isinstance(fee, Decimal), listing.slug
                assert fee == fee.quantize(Decimal("0.01")), listing.slug
            assert service.fee_min_naira <= service.fee_max_naira, listing.slug
            assert service.collected_at is not None, listing.slug
    assert fee_count > 0


# --- blood (FR-27, FR-28) ---

def test_blood_banks_list_valid_blood_groups_with_a_confirmed_date():
    blood_banks = [listing for listing in LISTINGS if listing.category_slug == "blood-bank"]
    assert len(blood_banks) >= 3
    for listing in blood_banks:
        groups = [service for service in listing.services if service.name in BLOOD_GROUPS]
        assert groups, listing.slug
        assert all(service.collected_at is not None for service in groups), listing.slug


def test_a_hospital_has_a_blood_bank_service_and_donation_centres_exist():
    service_names = {service.name for listing in LISTINGS for service in listing.services}
    assert "Blood bank" in service_names
    donation_centres = [listing for listing in LISTINGS
                        if any(service.name == "Blood donation" for service in listing.services)]
    assert len(donation_centres) >= 2


# --- running the seed ---

@pytest.mark.anyio
async def test_running_the_seed_creates_the_expected_rows(session):
    created = await run(session, TEST_PASSWORDS)
    assert created == {"categories": len(CATEGORIES), "users": len(USERS), "listings": len(LISTINGS)}
    assert await count_rows(session, Category) == len(CATEGORIES)
    assert await count_rows(session, User) == len(USERS)
    assert await count_rows(session, Listing) == len(LISTINGS)
    assert await count_rows(session, AuditEntry) == len(LISTINGS)  # FR-38: one create entry per listing


@pytest.mark.anyio
async def test_published_listings_have_a_passing_call_and_visit_and_a_due_date(session):
    await run(session, TEST_PASSWORDS)
    published = (await session.exec(select(Listing).where(Listing.status == ListingStatus.published))).all()
    for listing in published:
        checks = (await session.exec(
            select(VerificationCheck).where(VerificationCheck.listing_id == listing.id)
        )).all()
        assert {check.method.value for check in checks if check.result == CheckResult.passed} == {
            "call", "visit"}, listing.slug
        assert listing.last_verified_at is not None and listing.next_check_due is not None, listing.slug


@pytest.mark.anyio
async def test_the_provider_owns_exactly_one_listing_and_the_verifier_created_all(session):
    await run(session, TEST_PASSWORDS)
    provider = (await session.exec(select(User).where(User.role == Role.provider))).one()
    verifier = (await session.exec(select(User).where(User.role == Role.verifier))).one()
    owned = (await session.exec(select(Listing).where(Listing.owner_id == provider.id))).all()
    assert len(owned) == 1
    # Since accounts phase 6a the access is an approved link, and the seed makes it too.
    links = (await session.exec(select(FacilityOwner).where(FacilityOwner.user_id == provider.id))).all()
    found = [(link.listing_id, link.role, link.status) for link in links]
    assert found == [(owned[0].id, "owner", "approved")]
    assert all(listing.created_by == verifier.id for listing in (await session.exec(select(Listing))).all())


@pytest.mark.anyio
async def test_running_the_seed_twice_creates_no_duplicates(session):
    await run(session, TEST_PASSWORDS)
    row_counts_after_first_run = {
        model.__name__: await count_rows(session, model)
        for model in (Category, User, Listing, PhoneNumber, OpeningHours, Service, VerificationCheck,
                      AuditEntry)
    }
    created_second_time = await run(session, TEST_PASSWORDS)
    assert created_second_time == {"categories": 0, "users": 0, "listings": 0}
    for model in (Category, User, Listing, PhoneNumber, OpeningHours, Service, VerificationCheck, AuditEntry):
        assert await count_rows(session, model) == row_counts_after_first_run[model.__name__], model.__name__


@pytest.mark.anyio
async def test_rerunning_does_not_reset_a_changed_password(session):
    await run(session, TEST_PASSWORDS)
    admin = (await session.exec(select(User).where(User.role == Role.admin))).one()
    admin.password_hash = "changed-by-the-admin"
    session.add(admin)
    await session.commit()
    await run(session, TEST_PASSWORDS)
    await session.refresh(admin)
    assert admin.password_hash == "changed-by-the-admin"

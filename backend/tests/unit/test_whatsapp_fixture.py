"""The local WhatsApp test fixture: the data rules and the guard. Requirements: FR-47, FR-22, US-06, NFR-07.

Spec: specs/2026-10-13-listing-page/requirements.md D11. Pure data and the environment check: no database.
The fixture is one clearly fictional listing for looking at the listing page (WhatsApp button, fees,
past-midnight hours, the reported notice) on a developer's machine. It is not part of the main seed or of the
production demo listings, and it refuses to run anywhere but development.
"""
import re

import pytest

from seed.demo_listings_data import DEMO_LISTINGS
from seed.seed_data import LISTINGS, USERS
from seed.whatsapp_fixture import (
    FIXTURE_HOURS,
    FIXTURE_NAME,
    FIXTURE_PHONES,
    FIXTURE_PHOTO_URL,
    FIXTURE_REPORTER_KEYS,
    FIXTURE_SERVICES,
    FIXTURE_SLUG,
    environment_allows,
)


def test_the_name_and_the_slug_say_that_it_is_a_fictional_test_fixture() -> None:
    assert FIXTURE_NAME.startswith("TEST FIXTURE (fictional)")
    assert FIXTURE_SLUG == "test-fixture-whatsapp-clinic"  # written out: the owner opens this address


def test_the_slug_and_the_name_do_not_clash_with_the_main_seed_or_the_demo_listings() -> None:
    others = (*LISTINGS, *DEMO_LISTINGS)

    assert FIXTURE_SLUG not in {listing.slug for listing in others}
    assert FIXTURE_NAME.lower() not in {listing.name.lower() for listing in others}


def test_every_number_is_impossible_so_a_wa_me_link_cannot_reach_a_real_person() -> None:
    other_numbers = {phone.number for listing in (*LISTINGS, *DEMO_LISTINGS) for phone in listing.phones}
    other_numbers |= {user.phone for user in USERS}

    assert len(FIXTURE_PHONES) == 3
    for phone in FIXTURE_PHONES:
        assert re.fullmatch(r"\+2340\d{9}", phone.number), phone.number  # +234 then a zero: never real
        assert phone.number not in other_numbers
    assert len({phone.number for phone in FIXTURE_PHONES}) == 3


def test_it_shows_each_whatsapp_case_primary_on_whatsapp_one_other_not_one_other_yes() -> None:
    assert [phone.is_primary for phone in FIXTURE_PHONES] == [True, False, False]
    assert [phone.is_whatsapp for phone in FIXTURE_PHONES] == [True, False, True]


def test_the_hours_cover_seven_days_with_a_shift_past_midnight_and_a_closed_day() -> None:
    assert sorted(hours.day_of_week for hours in FIXTURE_HOURS) == list(range(7))
    open_days = [hours for hours in FIXTURE_HOURS if not hours.is_closed]
    assert any(hours.closes_at < hours.opens_at for hours in open_days)  # past midnight
    assert any(hours.is_closed for hours in FIXTURE_HOURS)


def test_the_services_show_the_five_fee_cases() -> None:
    cases = {
        (
            service.fee_min_naira is not None,
            service.fee_max_naira is not None,
            service.fee_min_naira == service.fee_max_naira,
        )
        for service in FIXTURE_SERVICES
    }
    assert (True, True, False) in cases  # a range
    assert (True, True, True) in cases  # one amount
    assert (True, False, False) in cases  # a minimum only
    assert (False, False, True) in cases  # no fee
    assert any(service.collected_at is not None for service in FIXTURE_SERVICES)  # with a date
    assert any(  # a fee without a date
        service.fee_min_naira is not None and service.collected_at is None for service in FIXTURE_SERVICES
    )


def test_two_different_reporters_make_it_recently_reported_as_not_working() -> None:
    assert len(set(FIXTURE_REPORTER_KEYS)) == 2


def test_the_photo_is_an_https_address() -> None:
    assert FIXTURE_PHOTO_URL.startswith("https://")


@pytest.mark.parametrize("environment, allowed", [
    ({}, True),  # nothing set: the setting's own default is development
    ({"APP_ENV": "development"}, True),
    ({"APP_ENV": "production"}, False),
    ({"APP_ENV": "Production"}, False),
    ({"APP_ENV": " production "}, False),
    ({"APP_ENV": "staging"}, False),  # only development is allowed, not "anything but production"
    ({"APP_ENV": ""}, False),
])
def test_it_runs_only_in_development(environment: dict[str, str], allowed: bool) -> None:
    assert environment_allows(environment) is allowed

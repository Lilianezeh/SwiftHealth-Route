"""Tests for core/service_catalogue.py. Requirements: FR-31, US-05.
Decision C1 in specs/2026-10-20-staff-screens/requirements.md.

The catalogue is the fixed list of service names that staff pick from. A name is matched by the
same-service rule of GET /meta, so "x ray" is not "X-ray" but "xray" and " X-RAY " are, and the stored
spelling is always the catalogue's.
"""

import pytest

from app.core.config import BLOOD_GROUPS
from app.core.service_catalogue import (
    CATALOGUE_SERVICE_NAMES,
    canonical_service_name,
    catalogue_for_meta,
)
from app.core.service_names import normalise_service_name
from seed.demo_listings_data import DEMO_LISTINGS
from seed.seed_data import LISTINGS


def test_every_service_of_the_seed_and_the_demo_listings_is_in_the_catalogue() -> None:
    names = {service.name for listing in (*LISTINGS, *DEMO_LISTINGS) for service in listing.services}
    assert names, "the seed has services"
    assert [name for name in sorted(names) if canonical_service_name(name) is None] == []


def test_the_blood_groups_are_allowed_but_not_listed_for_picking_in_the_catalogue_of_meta() -> None:
    assert all(canonical_service_name(group) == group for group in BLOOD_GROUPS)
    assert not set(BLOOD_GROUPS) & set(catalogue_for_meta())


def test_blood_bank_and_blood_donation_are_allowed_for_phase_8() -> None:
    assert canonical_service_name("Blood bank") == "Blood bank"
    assert canonical_service_name("Blood donation") == "Blood donation"


def test_no_two_catalogue_names_are_the_same_service() -> None:
    keys = [normalise_service_name(name) for name in (*CATALOGUE_SERVICE_NAMES, *BLOOD_GROUPS)]
    assert len(keys) == len(set(keys))


@pytest.mark.parametrize("typed", ["X-ray", "xray", " x-RAY ", "X-RAY", "x-ray"])
def test_spellings_of_a_catalogue_name_give_the_catalogue_spelling(typed: str) -> None:
    assert canonical_service_name(typed) == "X-ray"


@pytest.mark.parametrize("typed", ["X ray", "", "   ", "-", "Magic cure", "Consultations"])
def test_a_name_that_is_not_in_the_catalogue_is_refused(typed: str) -> None:
    assert canonical_service_name(typed) is None


def test_the_list_for_meta_is_alphabetical_ignoring_case_and_without_duplicates() -> None:
    names = catalogue_for_meta()
    assert names == sorted(names, key=lambda name: (name.casefold(), name))
    assert len(names) == len(set(names))
    assert "Consultation" in names


def test_the_names_added_beyond_the_seed_are_plain_labels_of_what_a_facility_offers() -> None:
    """The six general names of decision C1, so a change to them is a visible decision."""
    for name in (
        "Emergency care",
        "Dental care",
        "Vaccination",
        "Surgery",
        "Physiotherapy",
        "Pharmacy dispensing",
    ):
        assert canonical_service_name(name) == name

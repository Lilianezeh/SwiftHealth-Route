"""Tests for core/phone.py. Requirements: US-08, FR-21 (optional reporter phone), NFR-07.
api-spec "Conventions": accepted as 0803... or +234803..., stored as +234803..."""

import pytest

from app.core.phone import normalise_nigerian_phone


@pytest.mark.parametrize(
    "raw",
    [
        "08030000000",
        "0803 000 0000",
        "0803-000-0000",
        "+2348030000000",
        "2348030000000",
        " +234 803 000 0000 ",
    ],
)
def test_every_usual_way_of_writing_a_nigerian_number_becomes_plus_234(raw: str) -> None:
    assert normalise_nigerian_phone(raw) == "+2348030000000"


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "   ",
        "0803",
        "080300000001",
        "123456789",
        "+14155550123",
        "abcdefghijk",
        "0803000000a",
        "+2340803000000",
    ],
)
def test_anything_else_is_not_a_number(raw: str) -> None:
    assert normalise_nigerian_phone(raw) is None

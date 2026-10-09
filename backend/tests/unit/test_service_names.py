"""The one rule for "the same service". Requirements: FR-05, US-05.

Decision 9 in specs/2026-10-09-meta-endpoint/requirements.md: two names are the same service when they are
equal after trimming the ends, joining runs of white space into one space, removing hyphens and lower-casing.
"""
import pytest

from app.core.service_names import normalise_service_name


@pytest.mark.parametrize(
    "name",
    ["X-ray", "x-ray", " X-ray ", "Xray", "XRAY", "X-RAY", "xray", "\tX-ray\n", "x--ray", "-X-ray-"],
)
def test_the_rule_trims_joins_spaces_removes_hyphens_and_lowers_case(name: str) -> None:
    assert normalise_service_name(name) == "xray"


@pytest.mark.parametrize(
    "name, expected",
    [
        ("Pap  Smear", "pap smear"),  # runs of spaces become one
        ("Pap\tSmear", "pap smear"),  # tabs and new lines count as spaces
        ("Pap \n Smear", "pap smear"),
        ("  Malaria test  ", "malaria test"),
        ("Malaria-test", "malariatest"),  # the hyphen goes, no space is put in its place
        ("x - ray", "x ray"),  # the hyphen goes and the spaces around it become one
    ],
)
def test_spaces_are_joined_but_never_removed(name: str, expected: str) -> None:
    assert normalise_service_name(name) == expected


@pytest.mark.parametrize(
    "first, second",
    [
        ("X ray", "Xray"),  # a space is not a hyphen
        ("Ultrasound", "X-ray"),
        ("Pap smear", "Pap-smear"),  # known limit: the hyphen is removed, the space is not
        ("A+", "A-"),
        ("Blood test", "Blood tests"),
    ],
)
def test_names_that_are_different_services_stay_different(first: str, second: str) -> None:
    assert normalise_service_name(first) != normalise_service_name(second)


@pytest.mark.parametrize("name", ["X-ray", " Pap  Smear-test ", "CONSULTATION GÉNÉRALE", "", "---", "  "])
def test_the_rule_gives_the_same_answer_when_applied_twice(name: str) -> None:
    once = normalise_service_name(name)
    assert normalise_service_name(once) == once


@pytest.mark.parametrize("name", ["", " ", "-", "--", " - ", "\t-\n"])
def test_a_name_of_only_hyphens_and_spaces_becomes_empty(name: str) -> None:
    assert normalise_service_name(name) == ""


def test_accented_capitals_are_lowered() -> None:
    assert normalise_service_name("CONSULTATION GÉNÉRALE") == "consultation générale"
    assert normalise_service_name("Ñandú") == "ñandú"

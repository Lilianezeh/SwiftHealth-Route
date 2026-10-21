"""Tests for core/csv_cells.py. Requirements: FR-40, NFR-06. Decision E3: specs/2026-10-20-launch-readiness/.

A spreadsheet runs a cell that starts with = + - @ (or a tab or carriage return) as a formula, so an
export puts a ' in front of it.
"""

import pytest

from app.core.csv_cells import neutralise_cell


@pytest.mark.parametrize(
    "dangerous", ["=1+1", "+1", "-1", "@SUM(A1)", "\tx", "\rx", '=HYPERLINK("http://evil","x")', "-2+3"]
)
def test_a_cell_that_starts_like_a_formula_gets_a_quote_in_front(dangerous: str) -> None:
    assert neutralise_cell(dangerous) == "'" + dangerous


@pytest.mark.parametrize(
    "safe", ["Night Pharmacy", "12 Example Road", "a=b", "1500.00", "Ogui", "", "x-ray", "O+"]
)
def test_any_other_cell_is_left_alone(safe: str) -> None:
    assert neutralise_cell(safe) == safe


def test_none_becomes_an_empty_cell_and_other_values_become_text() -> None:
    assert neutralise_cell(None) == ""
    assert neutralise_cell(6.45) == "6.45"
    assert neutralise_cell(True) == "True"
    assert (
        neutralise_cell(-6.45) == "-6.45"
    )  # a number is not text typed by a person: the column stays a number column

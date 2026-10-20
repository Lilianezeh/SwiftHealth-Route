"""One rule for every cell of an exported CSV. Requirements: FR-40, NFR-06.
Decision E3 in specs/2026-10-20-launch-readiness/requirements.md.

A spreadsheet treats a cell that starts with `=`, `+`, `-`, `@`, a tab or a carriage return as a
formula (CSV injection: a facility name such as `=HYPERLINK(...)` could run when an admin opens the
file). A `'` in front makes it plain text.
"""

import re

FORMULA_STARTS = ("=", "+", "-", "@", "\t", "\r")
STORED_PHONE = re.compile(r"\+234[1-9]\d{9}")


def neutralise_cell(value: object) -> str:
    """The cell as text, safe to open in a spreadsheet. None is an empty cell.

    Only text typed by people (a `str`) can hold a formula. A number such as a negative latitude is
    written as it is, so the column stays a number column.
    """
    if value is None:
        return ""
    if not isinstance(value, str):
        return str(value)
    if STORED_PHONE.fullmatch(value):
        return value  # a stored phone number cannot be a formula, and an import reads it back as it is
    return f"'{value}" if value.startswith(FORMULA_STARTS) else value

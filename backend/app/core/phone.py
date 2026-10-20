"""Nigerian phone numbers: one way to write them down. Requirements: FR-21, NFR-07; api-spec, "Conventions".

A number is accepted as 0803 000 0000 or +234 803 000 0000 and stored as +2348030000000. Pure logic, no I/O.
"""

import re

# After +234 come ten digits and the first is never 0 (the 0 of 0803... is the prefix that +234 replaces).
INTERNATIONAL = re.compile(r"\+234[1-9]\d{9}")
LOCAL = re.compile(r"0([1-9]\d{9})")
INTERNATIONAL_WITHOUT_PLUS = re.compile(r"234([1-9]\d{9})")


def normalise_nigerian_phone(raw: str) -> str | None:
    """The number as +234 and ten digits, or None if the text is not a Nigerian number.

    Spaces, dashes, dots and brackets are ignored.
    """
    compact = re.sub(r"[\s\-().]", "", raw)
    if INTERNATIONAL.fullmatch(compact):
        return compact
    local = LOCAL.fullmatch(compact)
    if local:
        return f"+234{local.group(1)}"
    without_plus = INTERNATIONAL_WITHOUT_PLUS.fullmatch(compact)
    if without_plus:
        return f"+234{without_plus.group(1)}"
    return None

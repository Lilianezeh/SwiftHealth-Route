"""The one rule for "the same service". Requirements: FR-05, US-05.

`GET /meta` lists service names to pick from, and the `service` filter of `GET /search` finds the listings
that offer the picked one. Both must agree on what "the same service" means, or the pick-from-list would
silently miss listings. So the rule is written once, here, in two forms that must give the same answer
(a test asks the real database):

- `normalise_service_name`: plain Python, used by `meta_service` to merge names.
- `normalised_service_name_expression`: the same steps as SQL, used by `search_repository` to match names.

Two names are the same service when they are equal after (1) taking the spaces off both ends, (2) joining
runs of white space into one space, (3) removing hyphens (as the `q` match does: "xray" finds "X-ray") and
(4) lower-casing. So `X-ray`, `x-ray`, ` X-ray ` and `Xray` are one service, while `X ray` (a space) is
another. Decision 9 in specs/2026-10-09-meta-endpoint/requirements.md.
"""
from sqlalchemy import ColumnElement, func


def normalise_service_name(name: str) -> str:
    """The Python form of the rule. An empty answer means the name holds nothing but hyphens and spaces."""
    without_hyphens = name.replace("-", "")
    return " ".join(without_hyphens.split()).lower()


def normalised_service_name_expression(column: ColumnElement) -> ColumnElement[str]:
    """The SQL form of the rule: the same four steps, in PostgreSQL."""
    without_hyphens = func.replace(column, "-", "")
    one_space_between_words = func.regexp_replace(without_hyphens, r"\s+", " ", "g")
    return func.lower(func.btrim(one_space_between_words))

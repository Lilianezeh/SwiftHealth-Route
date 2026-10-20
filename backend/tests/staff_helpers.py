"""Helpers for the staff endpoint tests. Requirements: FR-30, FR-31, NFR-06.

`bearer_for` makes the header of a logged-in user (the token holds only the user id).
`listing_body` is a valid POST /listings body that a test changes in one place.
"""

from copy import deepcopy

from app.core.security import create_access_token
from app.models import User


def bearer_for(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


VALID_LISTING_BODY: dict = {
    "name": "Night Pharmacy A",
    "category": "pharmacy",
    "area": "New Haven",
    "address": "12 Example Road",
    "landmark": "Opposite the market",
    "latitude": 6.452,
    "longitude": 7.51,
    "description": None,
    "is_24_hours": False,
    "phones": [{"number": "08030000000", "label": "Front desk", "is_primary": True, "is_whatsapp": False}],
    "opening_hours": [{"day_of_week": 0, "opens_at": "20:00", "closes_at": "02:00", "is_closed": False}],
    "services": [
        {
            "name": "Malaria test",
            "fee_min_naira": "1500.00",
            "fee_max_naira": "3000.00",
            "fee_collected_at": "2026-09-28",
        }
    ],
}


def listing_body(**changes: object) -> dict:
    """A valid POST /listings body with the given fields replaced."""
    body = deepcopy(VALID_LISTING_BODY)
    body.update(changes)
    return body

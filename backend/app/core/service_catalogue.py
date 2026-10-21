"""The services that staff may pick for a listing. Requirements: FR-31, US-05.
Decision C1 in specs/2026-10-20-staff-screens/requirements.md.

A fixed list in code, like the areas (no new table: the project has exactly 9). The API refuses a name
that is not here and stores the catalogue's spelling, so "x-ray" and "Xray" cannot both exist. A name is
matched with the same-service rule of GET /meta (`core/service_names.py`). The blood groups are allowed
too (blood banks store them as services, CLAUDE.md) but are not in the list that `/meta` offers, because
they have their own list. To add a service, add its name here.
"""

from app.core.config import BLOOD_GROUPS
from app.core.service_names import normalise_service_name

# The services of the seed data, "Blood bank" and "Blood donation" (phase 8), and six general labels (C1).
CATALOGUE_SERVICE_NAMES: tuple[str, ...] = (
    "Antenatal care",
    "Blood bank",
    "Blood count",
    "Blood donation",
    "Blood pressure check",
    "Blood test",
    "Consultation",
    "Delivery",
    "Dental care",
    "Emergency care",
    "Eye test",
    "Home visit",
    "Malaria test",
    "Pharmacy dispensing",
    "Physiotherapy",
    "Prescription filling",
    "Surgery",
    "Typhoid test",
    "Ultrasound",
    "Vaccination",
    "X-ray",
)

_CANONICAL_BY_KEY: dict[str, str] = {
    normalise_service_name(name): name for name in (*CATALOGUE_SERVICE_NAMES, *BLOOD_GROUPS)
}


def canonical_service_name(name: str) -> str | None:
    """The catalogue's spelling of `name`, or None if the name is not in the catalogue."""
    key = normalise_service_name(name)
    return _CANONICAL_BY_KEY.get(key) if key else None


def catalogue_for_meta() -> list[str]:
    """The names `GET /meta` offers: alphabetical without regard to case, without the blood groups."""
    return sorted(CATALOGUE_SERVICE_NAMES, key=lambda name: (name.casefold(), name))

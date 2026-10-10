"""Listing shapes shared by search, emergency and blood results. See specs/backend/api-spec.md section 2."""
from datetime import datetime

from pydantic import BaseModel


class CategorySummary(BaseModel):
    slug: str
    name: str


class ListingSummary(BaseModel):
    """One result in a list. No status, owner or money fields: the public sees only what the spec lists."""

    id: int
    slug: str
    name: str
    category: CategorySummary
    area: str
    address: str
    latitude: float
    longitude: float
    distance_km: float | None  # null when the caller sent no location
    is_open_now: bool
    is_24_hours: bool
    primary_phone: str | None  # +234...
    last_verified_at: datetime | None
    verification_due: bool  # true when the re-check date has passed and the listing is still shown (FR-08)
    sponsored: bool  # always false until roadmap phase 12c
    # The next change in opening hours, in English and Lagos time ("Closes 9:00 PM", "Opens Monday 7:30 AM").
    # null for a 24-hour listing, a listing with no hours recorded, and the lists that do not fill it yet.
    hours_note: str | None = None

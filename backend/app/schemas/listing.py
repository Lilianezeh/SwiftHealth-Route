"""Listing shapes shared by search, emergency, blood results and the listing page.

See specs/backend/api-spec.md section 2.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, PlainSerializer

# Money is a Decimal in Python and a string with 2 decimals in JSON, e.g. "1500.00" (api-spec, Conventions).
Naira = Annotated[Decimal, PlainSerializer(lambda amount: f"{amount:.2f}", return_type=str, when_used="json")]


class CategorySummary(BaseModel):
    slug: str
    name: str


class MainFacilityRef(BaseModel):
    name: str
    slug: str


class BranchRef(BaseModel):
    """A published branch, as the main facility's page lists it."""

    name: str
    slug: str
    area: str


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
    # "Branch of {name}" (FR-52): set in search results and on the listing page when this listing is a
    # branch whose main facility is published; null otherwise, and always null in the SwiftRescue and
    # blood lists.
    branch_of: MainFacilityRef | None = None


class PhoneRead(BaseModel):
    number: str  # +234...
    label: str | None  # Front desk, Emergency...
    is_primary: bool
    is_whatsapp: bool  # only when staff or the provider said so (FR-47); false by default


class OpeningHoursRead(BaseModel):
    """One day of the week. A day with no hours is closed, with null times (api-spec, ListingDetail)."""

    day_of_week: int  # 0 = Monday ... 6 = Sunday
    opens_at: str | None  # "HH:MM", local time; null when closed
    closes_at: str | None  # earlier than opens_at means the shift runs past midnight
    is_closed: bool


class ServiceRead(BaseModel):
    name: str
    fee_min_naira: Naira | None
    fee_max_naira: Naira | None
    fee_collected_at: date | None


class ListingDetail(ListingSummary):
    """The public listing page (FR-09): the summary plus everything a visitor needs before they go."""

    landmark: str | None
    description: str | None
    entrance_photo_url: str | None
    phones: list[PhoneRead]  # the primary number first
    opening_hours: list[OpeningHoursRead]  # always 7, Monday first
    services: list[ServiceRead]
    # The FR-22 rule that hides a listing from search. The listing is still shown, so the page can warn.
    recently_reported_not_working: bool
    disclaimer: str  # FR-13
    branches: list[BranchRef] = []  # the published branches of this facility, by name (FR-52)

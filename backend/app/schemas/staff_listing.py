"""Shapes of the staff listing endpoints. See specs/backend/api-spec.md, section 5 and
"Phase 10 clarifications". Requirements: FR-31, FR-42, NFR-06. Decisions C1, C5 in
specs/2026-10-20-staff-screens/requirements.md.

What staff send (`ListingCreate`, `ListingUpdate`) is checked here, so the service only sees clean
values: phones as +234, service names in the catalogue spelling, fees as exact decimals.
"""

from datetime import date, datetime, time
from decimal import Decimal
from enum import Enum
from typing import Annotated, Self

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.config import settings
from app.core.phone import normalise_nigerian_phone
from app.core.service_catalogue import canonical_service_name
from app.models.base import ListingStatus
from app.schemas.listing import ListingDetail, ListingSummary

MAX_NAME_LENGTH = 120
MAX_FEE = Decimal("100000000")  # a sanity limit well inside NUMERIC(12,2)


class DueFilter(str, Enum):
    overdue = "overdue"
    this_week = "this_week"


class StaffListParams(BaseModel):
    """Query of GET /listings. `q` is the usual short name; in the code it is `search_text` (CLAUDE.md)."""

    status: ListingStatus | None = None
    category: str | None = Field(default=None, max_length=100)
    area: str | None = Field(default=None, max_length=100)
    search_text: str | None = Field(
        default=None, alias="q", max_length=100, description="Part of the listing name, ignoring case."
    )
    due: DueFilter | None = None
    mine: bool = False
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)

    @field_validator("search_text", "category", "area")
    @classmethod
    def blank_means_not_given(cls, text: str | None) -> str | None:
        return text.strip() or None if text is not None else None


class StaffListingSummary(ListingSummary):
    status: ListingStatus
    next_check_due: datetime | None
    created_by: int | None


class StaffListingList(BaseModel):
    items: list[StaffListingSummary]
    total: int


class StaffListingDetail(ListingDetail):
    """The public detail plus what only staff may see."""

    status: ListingStatus
    next_check_due: datetime | None
    owner_id: int | None
    created_by: int | None
    featured_until: datetime | None
    map_pin_is_default: bool  # the pin is still the default centre, so the editor can warn (decision C5)
    submission_details: str | None  # the text of a "List your facility" draft, for staff only (decision C6)
    closed_at: datetime | None  # set when the facility was closed (accounts phase 8a)
    closed_reason: str | None
    parent_id: int | None  # the main facility this listing is a branch of (accounts phase 8b)
    parent_name: str | None


class PhoneInput(BaseModel):
    number: str = Field(max_length=30)
    label: str | None = Field(default=None, max_length=50)
    is_primary: bool = False
    is_whatsapp: bool = False

    @field_validator("number")
    @classmethod
    def number_is_nigerian(cls, number: str) -> str:
        normalised = normalise_nigerian_phone(number)
        if normalised is None:
            raise ValueError("number must be a Nigerian phone number")
        return normalised

    @field_validator("label")
    @classmethod
    def blank_label_means_none(cls, label: str | None) -> str | None:
        return label.strip() or None if label is not None else None


class HoursInput(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    opens_at: time | None = None
    closes_at: time | None = None
    is_closed: bool = False

    @model_validator(mode="after")
    def open_days_need_both_times(self) -> Self:
        if self.is_closed:
            self.opens_at = self.closes_at = None
        elif self.opens_at is None or self.closes_at is None:
            raise ValueError("an open day needs opens_at and closes_at")
        return self


Money = Annotated[Decimal | None, Field(ge=0, le=MAX_FEE, max_digits=12, decimal_places=2)]


class ServiceInput(BaseModel):
    name: str = Field(max_length=100)
    fee_min_naira: Money = None
    fee_max_naira: Money = None
    fee_collected_at: date | None = None

    @field_validator("name")
    @classmethod
    def name_is_in_the_catalogue(cls, name: str) -> str:
        canonical = canonical_service_name(name)
        if canonical is None:
            raise ValueError("name is not in the service catalogue")
        return canonical

    @model_validator(mode="after")
    def minimum_is_not_above_maximum(self) -> Self:
        low, high = self.fee_min_naira, self.fee_max_naira
        if low is not None and high is not None and low > high:
            raise ValueError("fee_min_naira cannot be above fee_max_naira")
        return self


def check_phones(phones: list[PhoneInput]) -> list[PhoneInput]:
    if not phones:
        raise ValueError("a listing needs at least one phone number")
    if sum(phone.is_primary for phone in phones) != 1:
        raise ValueError("exactly one phone must be primary")
    return phones


def check_hours(hours: list[HoursInput]) -> list[HoursInput]:
    days = [entry.day_of_week for entry in hours]
    if len(days) != len(set(days)):
        raise ValueError("only one opening-hours row per day")
    return hours


def check_services(services: list[ServiceInput]) -> list[ServiceInput]:
    names = [service.name for service in services]
    if len(names) != len(set(names)):
        raise ValueError("a service can be listed only once")
    return services


class _ListingFields(BaseModel):
    """The checks both bodies share. Each runs only on a value that was sent."""

    @field_validator("area", check_fields=False)
    @classmethod
    def area_is_in_the_fixed_list(cls, area: str | None) -> str | None:
        if area is not None and area not in settings.areas:
            raise ValueError("area must be one of the areas in /meta")
        return area

    @field_validator("name", "address", "landmark", "description", check_fields=False)
    @classmethod
    def trim_text(cls, text: str | None) -> str | None:
        return text.strip() or None if text is not None else None

    @field_validator("phones", check_fields=False)
    @classmethod
    def phones_are_valid(cls, phones: list[PhoneInput] | None) -> list[PhoneInput] | None:
        return check_phones(phones) if phones is not None else None

    @field_validator("opening_hours", check_fields=False)
    @classmethod
    def hours_are_valid(cls, hours: list[HoursInput] | None) -> list[HoursInput] | None:
        return check_hours(hours) if hours is not None else None

    @field_validator("services", check_fields=False)
    @classmethod
    def services_are_valid(cls, services: list[ServiceInput] | None) -> list[ServiceInput] | None:
        return check_services(services) if services is not None else None


class ListingCreate(_ListingFields):
    name: str = Field(min_length=2, max_length=MAX_NAME_LENGTH)
    category: str = Field(min_length=1, max_length=100)
    area: str
    address: str = Field(min_length=3, max_length=200)
    landmark: str | None = Field(default=None, max_length=200)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    description: str | None = Field(default=None, max_length=1000)
    is_24_hours: bool = False
    phones: list[PhoneInput]
    opening_hours: list[HoursInput] = []
    services: list[ServiceInput] = []


class ListingUpdate(_ListingFields):
    """Every field is optional. A field that is not sent is left alone; `phones`, `opening_hours` and
    `services` replace the whole list when sent."""

    name: str | None = Field(default=None, min_length=2, max_length=MAX_NAME_LENGTH)
    category: str | None = Field(default=None, min_length=1, max_length=100)
    area: str | None = None
    address: str | None = Field(default=None, min_length=3, max_length=200)
    landmark: str | None = Field(default=None, max_length=200)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    description: str | None = Field(default=None, max_length=1000)
    is_24_hours: bool | None = None
    phones: list[PhoneInput] | None = None
    opening_hours: list[HoursInput] | None = None
    services: list[ServiceInput] | None = None
    # The main facility of a branch (accounts phase 8b): a number sets it, null clears it. Editors and
    # admins only (the route checks), and not a field a provider may send (api-spec 7, "Phase 8b").
    parent_id: int | None = None

    @model_validator(mode="after")
    def required_values_are_not_null(self) -> Self:
        for field in (
            "name",
            "category",
            "area",
            "address",
            "latitude",
            "longitude",
            "is_24_hours",
            "phones",
        ):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self

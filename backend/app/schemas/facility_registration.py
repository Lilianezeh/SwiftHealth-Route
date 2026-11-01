"""Shapes of registering a facility and claiming one. See specs/backend/api-spec.md section 7, "Phase 7".
Requirements: FR-50, FR-51, US-17. Replaces the open form's `schemas/submission.py` (decision D14):
the contact name and email are no longer asked, they come from the account.
"""

from decimal import Decimal
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.config import NIGERIA_LATITUDE_RANGE, NIGERIA_LONGITUDE_RANGE, settings
from app.core.phone import normalise_nigerian_phone
from app.core.photo_address import check_owner_photo_address
from app.core.service_catalogue import canonical_service_name
from app.integrations.cloudinary import CloudinaryNotConfiguredError, parse_cloudinary_url
from app.schemas.admin_user import MAX_EMAIL_LENGTH, check_email
from app.schemas.owner_link import CategoryRef
from app.schemas.staff_listing import HoursInput, check_hours

NOTES_MAX_LENGTH = 300
DESCRIPTION_MAX_LENGTH = 200  # the owner form's short description (the staff editor allows more)
LANDMARK_MAX_LENGTH = 200
MAX_OTHER_PHONES = 4  # besides the main number
PHOTO_URL_MAX_LENGTH = 500
LATITUDE_MIN, LATITUDE_MAX = NIGERIA_LATITUDE_RANGE
LONGITUDE_MIN, LONGITUDE_MAX = NIGERIA_LONGITUDE_RANGE
RequestedRole = Literal["owner", "manager"]


class OtherPhone(BaseModel):
    """A number besides the main one: an optional label, and whether the number has WhatsApp."""

    number: str = Field(max_length=30)
    label: str | None = Field(default=None, max_length=50)
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


class FacilityRegister(BaseModel):
    """The owner form. Also the body of `PUT /provider/requests/{link_id}`. `save_as_draft` keeps the request
    with the owner (no payment asked, staff see nothing); without it the request is sent."""

    facility_name: str = Field(min_length=2, max_length=120)
    category: str = Field(min_length=1, max_length=100)
    area: str
    address: str = Field(min_length=3, max_length=200)
    landmark: str | None = Field(default=None, max_length=LANDMARK_MAX_LENGTH)
    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX_LENGTH)
    email: str | None = Field(default=None, max_length=MAX_EMAIL_LENGTH)  # staff only
    phone: str = Field(max_length=30)  # the main number: the one staff phone
    phone_has_whatsapp: bool = False
    other_phones: list[OtherPhone] = Field(default_factory=list, max_length=MAX_OTHER_PHONES)
    is_24_hours: bool = False
    opening_hours: list[HoursInput] = Field(default_factory=list)  # ignored when is_24_hours
    services: list[str] = Field(default_factory=list)  # names from the service catalogue
    # The exact location (owner form, part (b)): both or neither. Absent in a save keeps the stored pin.
    latitude: float | None = Field(default=None, ge=LATITUDE_MIN, le=LATITUDE_MAX)
    longitude: float | None = Field(default=None, ge=LONGITUDE_MIN, le=LONGITUDE_MAX)
    # An address in the owner photo folder of our Cloudinary account.
    # Absent in a save keeps the photo; null removes it.
    entrance_photo_url: str | None = Field(default=None, max_length=PHOTO_URL_MAX_LENGTH)
    role: RequestedRole = "owner"
    notes: str | None = Field(default=None, max_length=NOTES_MAX_LENGTH)
    save_as_draft: bool = False

    @field_validator("entrance_photo_url")
    @classmethod
    def photo_is_in_the_owner_folder(cls, address: str | None) -> str | None:
        try:
            cloud_name: str | None = parse_cloudinary_url(settings.cloudinary_url).cloud_name
        except CloudinaryNotConfiguredError:
            cloud_name = None  # no account set up: only the host and the folder are checked
        return check_owner_photo_address(address, cloud_name)

    @field_validator("facility_name", "address", "category")
    @classmethod
    def trim(cls, text: str) -> str:
        return text.strip()

    @field_validator("notes", "landmark", "description")
    @classmethod
    def blank_text_means_none(cls, text: str | None) -> str | None:
        return text.strip() or None if text is not None else None

    @field_validator("email")
    @classmethod
    def email_is_valid(cls, email: str | None) -> str | None:
        if email is None or not email.strip():
            return None
        return check_email(email)

    @field_validator("opening_hours")
    @classmethod
    def hours_are_valid(cls, hours: list[HoursInput]) -> list[HoursInput]:
        return check_hours(hours)

    @field_validator("services")
    @classmethod
    def services_are_in_the_catalogue(cls, names: list[str]) -> list[str]:
        canonical = [canonical_service_name(name) for name in names]
        if any(name is None for name in canonical):
            raise ValueError("a service is not in the service catalogue")
        if len(set(canonical)) != len(canonical):
            raise ValueError("a service can be listed only once")
        return [name for name in canonical if name is not None]

    @field_validator("area")
    @classmethod
    def area_is_in_the_fixed_list(cls, area: str) -> str:
        if area not in settings.areas:
            raise ValueError("area must be one of the areas in /meta")
        return area

    @field_validator("phone")
    @classmethod
    def phone_is_nigerian(cls, phone: str) -> str:
        normalised = normalise_nigerian_phone(phone)
        if normalised is None:
            raise ValueError("phone must be a Nigerian phone number")
        return normalised

    @model_validator(mode="after")
    def no_number_twice(self) -> Self:
        numbers = [self.phone, *(other.number for other in self.other_phones)]
        if len(set(numbers)) != len(numbers):
            raise ValueError("a phone number can be listed only once")
        return self

    @model_validator(mode="after")
    def pin_needs_latitude_and_longitude(self) -> Self:
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must be sent together")
        return self


class FacilityRegistered(BaseModel):
    message: str
    listing_id: int
    link_id: int
    # "awaiting_payment": the first month is paid before our team sees the request; "draft": saved, not sent;
    # "pending": a request that needed changes was sent again (already paid); "changes_requested": saved only.
    status: str
    fee_naira: Decimal  # "10000.00" (OWNER_FEE_NAIRA)


class FacilityRequestRead(BaseModel):
    """The form of a request as saved, to fill the form again. The numbers come back as stored (+234...)."""

    link_id: int
    listing_id: int
    status: str
    role: str
    notes: str | None
    facility_name: str
    category: str
    area: str
    address: str
    landmark: str | None
    description: str | None
    email: str | None
    phone: str
    phone_has_whatsapp: bool
    other_phones: list[OtherPhone]
    is_24_hours: bool
    opening_hours: list[HoursInput]
    services: list[str]
    latitude: float
    longitude: float
    map_pin_is_default: bool  # the owner has not placed the pin: it is still the default centre
    entrance_photo_url: str | None
    change_note: str | None  # staff's note while the request is `changes_requested`, else None


class BranchCreate(BaseModel):
    """A new branch of a main facility (Phase 8b). No category: the branch takes its main facility's. Any
    other field is refused, so a category sent by mistake is a 422 and not silently ignored."""

    model_config = ConfigDict(extra="forbid")

    facility_name: str = Field(min_length=2, max_length=120)
    area: str
    address: str = Field(min_length=3, max_length=200)
    phone: str = Field(max_length=30)
    notes: str | None = Field(default=None, max_length=NOTES_MAX_LENGTH)

    @field_validator("facility_name", "address")
    @classmethod
    def trim(cls, text: str) -> str:
        return text.strip()

    @field_validator("area")
    @classmethod
    def area_is_in_the_fixed_list(cls, area: str) -> str:
        if area not in settings.areas:
            raise ValueError("area must be one of the areas in /meta")
        return area

    @field_validator("phone")
    @classmethod
    def phone_is_nigerian(cls, phone: str) -> str:
        normalised = normalise_nigerian_phone(phone)
        if normalised is None:
            raise ValueError("phone must be a Nigerian phone number")
        return normalised


class BranchCreated(BaseModel):
    message: str
    listing_id: int


class BranchItem(BaseModel):
    id: int
    name: str
    area: str
    status: str


class BranchList(BaseModel):
    items: list[BranchItem]


class ClaimCreate(BaseModel):
    listing_id: int
    role: RequestedRole = "owner"
    reason: str = Field(min_length=3, max_length=NOTES_MAX_LENGTH)

    @field_validator("reason")
    @classmethod
    def trim_reason(cls, reason: str) -> str:
        reason = reason.strip()
        if len(reason) < 3:
            raise ValueError("reason must have at least 3 characters")
        return reason


class ClaimCreated(BaseModel):
    message: str
    link_id: int
    status: str  # "awaiting_payment": the first month is paid before our team sees the request
    fee_naira: Decimal  # "10000.00" (OWNER_FEE_NAIRA)


class ClaimableItem(BaseModel):
    """Only what a person needs to recognise their facility: no phone, address or description."""

    id: int
    name: str
    area: str
    category: CategoryRef


class ClaimableList(BaseModel):
    items: list[ClaimableItem]

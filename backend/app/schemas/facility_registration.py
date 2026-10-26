"""Shapes of registering a facility and claiming one. See specs/backend/api-spec.md section 7, "Phase 7".
Requirements: FR-50, FR-51, US-17. Replaces the open form's `schemas/submission.py` (decision D14):
the contact name and email are no longer asked, they come from the account.
"""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.core.config import settings
from app.core.phone import normalise_nigerian_phone
from app.schemas.owner_link import CategoryRef

NOTES_MAX_LENGTH = 300
RequestedRole = Literal["owner", "manager"]


class FacilityRegister(BaseModel):
    facility_name: str = Field(min_length=2, max_length=120)
    category: str = Field(min_length=1, max_length=100)
    area: str
    address: str = Field(min_length=3, max_length=200)
    phone: str = Field(max_length=30)
    role: RequestedRole = "owner"
    notes: str | None = Field(default=None, max_length=NOTES_MAX_LENGTH)

    @field_validator("facility_name", "address", "category")
    @classmethod
    def trim(cls, text: str) -> str:
        return text.strip()

    @field_validator("notes")
    @classmethod
    def blank_notes_mean_none(cls, notes: str | None) -> str | None:
        return notes.strip() or None if notes is not None else None

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


class FacilityRegistered(BaseModel):
    message: str
    listing_id: int
    link_id: int


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


class ClaimableItem(BaseModel):
    """Only what a person needs to recognise their facility: no phone, address or description."""

    id: int
    name: str
    area: str
    category: CategoryRef


class ClaimableList(BaseModel):
    items: list[ClaimableItem]

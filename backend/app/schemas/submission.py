"""Request of POST /facility-submissions ("List your facility"). See specs/backend/api-spec.md.
Requirements: FR-37, NFR-07. Decisions C5 to C7 in specs/2026-10-20-staff-screens/requirements.md.
"""

import re

from pydantic import BaseModel, Field, field_validator

from app.core.config import settings
from app.core.phone import normalise_nigerian_phone

# A simple shape check (no email-validator package): something, "@", something, a dot, something.
EMAIL_SHAPE = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")
MAX_EMAIL_LENGTH = 254


class SubmissionCreate(BaseModel):
    facility_name: str = Field(min_length=2, max_length=120)
    category: str = Field(min_length=1, max_length=100)
    area: str
    address: str = Field(min_length=3, max_length=200)
    phone: str = Field(max_length=30)
    contact_name: str = Field(min_length=2, max_length=100)
    contact_email: str = Field(max_length=MAX_EMAIL_LENGTH)
    notes: str | None = Field(default=None, max_length=500)

    @field_validator("facility_name", "address", "contact_name", "contact_email", "category")
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

    @field_validator("contact_email")
    @classmethod
    def email_has_a_valid_shape(cls, email: str) -> str:
        if not EMAIL_SHAPE.fullmatch(email):
            raise ValueError("contact_email must be an email address")
        return email


class SubmissionReceived(BaseModel):
    message: str

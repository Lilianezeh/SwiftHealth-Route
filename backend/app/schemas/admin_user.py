"""Shapes of the staff accounts endpoints. See specs/backend/api-spec.md, section 11.
Requirements: FR-41, NFR-06, NFR-07. Decision C10 in specs/2026-10-20-staff-screens/requirements.md.
"""

import re

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.phone import normalise_nigerian_phone
from app.models.base import Role
from app.schemas.auth import UserRead

MIN_PASSWORD_LENGTH = 10  # api-spec, section 11
MAX_PASSWORD_LENGTH = 128
EMAIL_SHAPE = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")
MAX_EMAIL_LENGTH = 254


def check_email(email: str) -> str:
    cleaned = email.strip().lower()
    if len(cleaned) > MAX_EMAIL_LENGTH or not EMAIL_SHAPE.fullmatch(cleaned):
        raise ValueError("email must be an email address")
    return cleaned


def check_phone(phone: str) -> str:
    normalised = normalise_nigerian_phone(phone)
    if normalised is None:
        raise ValueError("phone must be a Nigerian phone number")
    return normalised


class AdminUserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str
    phone: str = Field(max_length=30)
    role: Role
    password: str = Field(min_length=MIN_PASSWORD_LENGTH, max_length=MAX_PASSWORD_LENGTH)

    @field_validator("name")
    @classmethod
    def trim_name(cls, name: str) -> str:
        stripped = name.strip()
        if not stripped:
            raise ValueError("name cannot be blank")
        return stripped

    @field_validator("email")
    @classmethod
    def email_is_valid(cls, email: str) -> str:
        return check_email(email)

    @field_validator("phone")
    @classmethod
    def phone_is_nigerian(cls, phone: str) -> str:
        return check_phone(phone)


class AdminUserUpdate(BaseModel):
    """Every field is optional; one that is not sent is left alone."""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    phone: str | None = Field(default=None, max_length=30)
    role: Role | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=MIN_PASSWORD_LENGTH, max_length=MAX_PASSWORD_LENGTH)
    listing_id: int | None = Field(default=None, description="For a provider: the listing they own.")

    @field_validator("name")
    @classmethod
    def trim_name(cls, name: str | None) -> str | None:
        if name is None:
            return None
        stripped = name.strip()
        if not stripped:
            raise ValueError("name cannot be blank")
        return stripped

    @field_validator("phone")
    @classmethod
    def phone_is_nigerian(cls, phone: str | None) -> str | None:
        return check_phone(phone) if phone is not None else None

    @model_validator(mode="after")
    def required_values_are_not_null(self) -> "AdminUserUpdate":
        for field in ("name", "phone", "role", "is_active", "password"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class AdminUserList(BaseModel):
    items: list[UserRead]
    total: int

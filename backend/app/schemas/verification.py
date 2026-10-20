"""Shapes of the checks and the status moves. See specs/backend/api-spec.md, section 5 and
"Phase 10 clarifications". Requirements: FR-32, US-10, FR-36. Decisions C3, C4, C8 in
specs/2026-10-20-staff-screens/requirements.md.
"""

from datetime import datetime
from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator

from app.models.base import CheckMethod, CheckResult

CLOUDINARY_HOST = "res.cloudinary.com"


class CheckCreate(BaseModel):
    method: CheckMethod
    result: CheckResult
    person_reached: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=1000)
    photo_url: str | None = Field(default=None, max_length=500)

    @field_validator("person_reached", "notes")
    @classmethod
    def blank_means_none(cls, text: str | None) -> str | None:
        return text.strip() or None if text is not None else None

    @field_validator("photo_url")
    @classmethod
    def photo_comes_from_cloudinary(cls, address: str | None) -> str | None:
        """Only an https address on res.cloudinary.com: a photo link never points at another site (C8)."""
        if address is None or not address.strip():
            return None
        parts = urlparse(address.strip())
        if parts.scheme != "https" or parts.hostname != CLOUDINARY_HOST or parts.username or parts.port:
            raise ValueError("photo_url must be an https://res.cloudinary.com/ address")
        return address.strip()


class CheckRead(BaseModel):
    id: int
    method: CheckMethod
    result: CheckResult
    person_reached: str | None
    notes: str | None
    photo_url: str | None
    checked_at: datetime
    staff_id: int
    staff_name: str


class CheckList(BaseModel):
    items: list[CheckRead]
    total: int


class HideRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=200)

    @field_validator("reason")
    @classmethod
    def reason_is_not_blank(cls, reason: str) -> str:
        stripped = reason.strip()
        if not stripped:
            raise ValueError("reason cannot be blank")
        return stripped

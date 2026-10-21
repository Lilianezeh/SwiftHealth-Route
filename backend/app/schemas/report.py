"""Request and response of POST /reports. See specs/backend/api-spec.md (US-08, FR-20, FR-21)."""

from pydantic import BaseModel, Field, field_validator

from app.core.phone import normalise_nigerian_phone
from app.models.base import ReportReason

MAX_COMMENT_LENGTH = 500


class ReportCreate(BaseModel):
    listing_id: int
    reason: ReportReason
    comment: str | None = Field(default=None, max_length=MAX_COMMENT_LENGTH)
    reporter_phone: str | None = Field(
        default=None,
        description="Optional. Accepted as 0803... or +234803... and stored as +234803...",
        max_length=30,
    )

    @field_validator("comment")
    @classmethod
    def blank_comment_means_none(cls, comment: str | None) -> str | None:
        return comment.strip() or None if comment is not None else None

    @field_validator("reporter_phone")
    @classmethod
    def phone_is_a_nigerian_number(cls, phone: str | None) -> str | None:
        if phone is None or not phone.strip():
            return None
        normalised = normalise_nigerian_phone(phone)
        if normalised is None:
            raise ValueError("reporter_phone must be a Nigerian phone number")
        return normalised


class ReportCreated(BaseModel):
    id: int
    message: str

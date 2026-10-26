"""Request shapes of the admin's decisions on accounts.
See specs/backend/api-spec.md section 11, "Phase 4a". Requirements: FR-49, FR-55, US-18.
The answer of each decision is an `AdminUserRow` (schemas/admin_user.py)."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

REASON_MAX_LENGTH = 500


class ApproveRequest(BaseModel):
    # Only these two: nobody becomes an admin or a provider by approval (an admin is made by an admin).
    role: Literal["editor", "verifier"]


class RejectRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=REASON_MAX_LENGTH)

    @field_validator("reason")
    @classmethod
    def blank_is_no_reason(cls, reason: str | None) -> str | None:
        stripped = reason.strip() if reason is not None else None
        return stripped or None


class SuspendRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=REASON_MAX_LENGTH)

    @field_validator("reason")
    @classmethod
    def not_blank(cls, reason: str) -> str:
        stripped = reason.strip()
        if not stripped:
            raise ValueError("reason cannot be blank")
        return stripped

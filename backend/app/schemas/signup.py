"""Request and response shapes of sign-up. See specs/backend/api-spec.md section 4c (FR-48, FR-49)."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.admin_user import check_email, check_phone


class SignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str
    phone: str = Field(max_length=30)
    # The rule (8 for a provider, 10 for staff, nothing common) is checked in the service.
    password: str = Field(max_length=1000)
    account_type: Literal["staff", "provider"]
    # Staff only: who they are and who can vouch for them.
    note: str | None = Field(default=None, max_length=500)

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

    @field_validator("note")
    @classmethod
    def trim_note(cls, note: str | None) -> str | None:
        stripped = note.strip() if note is not None else None
        return stripped or None


class ConfirmStep(BaseModel):
    """The answer of sign-up and of "confirm email": a token for the next code, and where it went (masked)."""

    confirm_token: str
    sent_to: str  # a***@example.com for the email code, +234******0123 for the phone code


class EmailConfirmedResponse(BaseModel):
    """The answer of "confirm email". With Termii live: `phone_code_sent`, with the token and hint of the
    phone code. Without Termii the sign-up is finished: `active` or `waiting_for_approval`, no token."""

    status: Literal["phone_code_sent", "active", "waiting_for_approval"]
    confirm_token: str | None = None
    sent_to: str | None = None


class ConfirmRequest(BaseModel):
    confirm_token: str  # a bad or expired one is answered with 401, not 422
    code: str  # a plain string on purpose: a wrong shape is answered with 401, not 422


class ResendRequest(BaseModel):
    confirm_token: str


class SignupDone(BaseModel):
    status: Literal["active", "waiting_for_approval"]

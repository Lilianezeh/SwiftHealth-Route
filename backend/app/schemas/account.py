"""Request and response shapes of account self-service. See specs/backend/api-spec.md section 4d.
Requirements: FR-54, FR-56, US-21. The id of the account is never in a request: the routes act on the
caller's own account."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.models.base import Role
from app.schemas.admin_user import PASSWORD_BODY_LIMIT, check_email, check_phone


class AccountRead(BaseModel):
    id: int
    name: str
    email: str
    phone: str | None
    role: Role
    approval_status: str
    email_confirmed: bool
    phone_confirmed: bool
    two_factor_enabled: bool


class NameChange(BaseModel):
    name: str = Field(min_length=1, max_length=100)

    @field_validator("name")
    @classmethod
    def trim_name(cls, name: str) -> str:
        stripped = name.strip()
        if not stripped:
            raise ValueError("name cannot be blank")
        return stripped


class EmailStart(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def email_is_valid(cls, email: str) -> str:
        return check_email(email)


class PhoneStart(BaseModel):
    phone: str = Field(max_length=30)

    @field_validator("phone")
    @classmethod
    def phone_is_nigerian(cls, phone: str) -> str:
        return check_phone(phone)


class ContactStep(BaseModel):
    """The answer of "start a new email or phone": a token for the code, and where it went (masked).
    Both are null when no code was needed (a new phone while Termii is off)."""

    confirm_token: str | None
    sent_to: str | None


class CodeConfirm(BaseModel):
    confirm_token: str  # a bad or expired one is answered with 401, not 422
    code: str  # a plain string on purpose: a wrong shape is answered with 401, not 422


class PasswordChange(BaseModel):
    current_password: str = Field(max_length=PASSWORD_BODY_LIMIT)
    new_password: str = Field(max_length=PASSWORD_BODY_LIMIT)  # the rule: in the service


class PasswordChanged(BaseModel):
    access_token: str  # a new token: every older one has stopped working
    token_type: str = "bearer"
    expires_in: int  # seconds


class CloseRequest(BaseModel):
    password: str = Field(max_length=PASSWORD_BODY_LIMIT)
    confirmation: Literal["CLOSE"]  # the typed word; anything else is 422


class Closed(BaseModel):
    closed: bool = True


class ForgotRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def email_is_valid(cls, email: str) -> str:
        return check_email(email)


class ForgotStep(BaseModel):
    """The same shape whether or not the email is an account."""

    reset_token: str
    sent_to: str


class ResetRequest(BaseModel):
    reset_token: str  # a bad or expired one is answered with 401, not 422
    code: str
    new_password: str = Field(max_length=PASSWORD_BODY_LIMIT)  # the rule: in the service


class Reset(BaseModel):
    reset: bool = True

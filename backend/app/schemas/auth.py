"""Request and response shapes for /auth. See specs/backend/api-spec.md section 4 (FR-30)."""
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.models.base import Role


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    challenge_token: str
    # Where the code went, masked: +234******0001 for "sms", a***@example.com for "email", null for "totp"
    # (nothing is sent).
    sent_to: str | None
    method: Literal["sms", "email", "totp"] = "sms"  # what the second step asks for (FR-58, D19)
    can_use_sms: bool = False  # with "totp": SMS may be asked for instead (Termii set up, phone confirmed)


class UseSmsRequest(BaseModel):
    challenge_token: str  # the app challenge from POST /auth/login; a bad one is answered with 401, not 422


class ResendCodeRequest(BaseModel):
    challenge_token: str  # the current one; a bad or expired one is answered with 401, not 422


class VerifyCodeRequest(BaseModel):
    challenge_token: str
    code: str  # a plain string on purpose: a malformed code is answered with 401, not 422


class UserRead(BaseModel):
    """What the API shows about a user. Never includes password_hash."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    phone: str | None
    role: Role
    is_active: bool
    two_factor_enabled: bool = False  # the authenticator app is switched on (FR-58)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
    user: UserRead

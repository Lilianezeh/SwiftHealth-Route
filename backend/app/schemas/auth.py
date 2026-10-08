"""Request and response shapes for /auth. See specs/backend/api-spec.md section 4 (FR-30)."""
from pydantic import BaseModel, ConfigDict

from app.models.base import Role


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    challenge_token: str
    sent_to: str  # masked, for example +234******0001


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


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
    user: UserRead

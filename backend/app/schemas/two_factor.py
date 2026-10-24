"""Request and response shapes of the authenticator app. See specs/backend/api-spec.md section 4b (FR-58)."""
from pydantic import BaseModel, Field


class TwoFactorStatusRead(BaseModel):
    enabled: bool
    backup_codes_left: int
    available: bool  # false: no usable encryption key on this server, so the set-up is "not available yet"


class StartRequest(BaseModel):
    password: str = Field(max_length=1000)  # the password typed again; wrong is 403, not 422


class StartResponse(BaseModel):
    secret: str  # shown once, to type into the app
    otpauth_uri: str  # the address a QR code holds


class ConfirmRequest(BaseModel):
    code: str = Field(max_length=100)  # a plain string on purpose: a wrong shape is "not right" (400)


class BackupCodesResponse(BaseModel):
    backup_codes: list[str]  # ten, shown this once


class PasswordAndCodeRequest(BaseModel):
    password: str = Field(max_length=1000)
    code: str = Field(max_length=100)  # a code from the app, or a backup code


class EnabledResponse(BaseModel):
    enabled: bool

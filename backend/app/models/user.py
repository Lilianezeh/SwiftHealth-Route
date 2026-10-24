from datetime import datetime

from sqlmodel import Field, SQLModel

from app.models.base import ApprovalStatus, Role, utcnow


class User(SQLModel, table=True):
    """Table 1: staff and provider accounts. The public never logs in."""
    __tablename__ = "users"

    id: int | None = Field(default=None, primary_key=True)
    name: str
    email: str = Field(unique=True, index=True)
    phone: str | None = None  # for Termii one-time codes
    password_hash: str
    role: Role
    is_active: bool = True  # false: suspended or closed
    created_at: datetime = Field(default_factory=utcnow)
    last_login_at: datetime | None = None
    # Accounts and sign-up (specs/2026-10-23-accounts-and-facility-ownership/, Phase 2). An account works
    # only when it is approved, has a confirmed email and phone, is active and is not closed;
    # get_current_user checks all of it on every request.
    approval_status: str = Field(
        default=ApprovalStatus.approved.value, sa_column_kwargs={"server_default": "approved"}
    )
    email_verified_at: datetime | None = None  # when the email was confirmed with a code (None: not yet)
    phone_verified_at: datetime | None = None
    signup_note: str | None = None  # a staff sign-up says who they are; at most 500 characters
    password_changed_at: datetime | None = None  # tokens made before this are refused (Phase 5)
    # Authenticator app (FR-58, Phase 2c). The secret is stored encrypted (core/secret_box.py); while
    # totp_enabled_at is empty it is only a set-up that was not finished and is not used for the login.
    totp_secret: str | None = None
    totp_enabled_at: datetime | None = None
    totp_last_step: int | None = None  # the last 30-second step accepted: a code is good once
    backup_code_hashes: str | None = None  # a JSON list of keyed hashes; a used code is removed
    closed_at: datetime | None = None  # closed by the person (Phase 5): the row stays, the data is replaced

    @property
    def two_factor_enabled(self) -> bool:
        """True when the person has switched on the authenticator app (a finished set-up)."""
        return self.totp_enabled_at is not None

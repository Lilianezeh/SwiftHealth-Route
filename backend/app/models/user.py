from datetime import datetime

from sqlmodel import Field, SQLModel

from app.models.base import Role, utcnow


class User(SQLModel, table=True):
    """Table 1: staff and provider accounts. The public never logs in."""
    __tablename__ = "users"

    id: int | None = Field(default=None, primary_key=True)
    name: str
    email: str = Field(unique=True, index=True)
    phone: str | None = None  # for Termii one-time codes
    password_hash: str
    role: Role
    is_active: bool = True
    created_at: datetime = Field(default_factory=utcnow)
    last_login_at: datetime | None = None

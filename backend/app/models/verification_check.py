from datetime import datetime

from sqlmodel import Field, SQLModel

from app.models.base import CheckMethod, CheckResult, utcnow


class VerificationCheck(SQLModel, table=True):
    """Table 7: every call and visit, kept as full history."""
    __tablename__ = "verification_checks"

    id: int | None = Field(default=None, primary_key=True)
    listing_id: int = Field(foreign_key="listings.id", index=True)
    staff_id: int = Field(foreign_key="users.id")
    method: CheckMethod
    result: CheckResult
    person_reached: str | None = None
    notes: str | None = None
    photo_url: str | None = None
    checked_at: datetime = Field(default_factory=utcnow)

from datetime import datetime

from sqlmodel import Field, SQLModel

from app.models.base import utcnow


class AuditEntry(SQLModel, table=True):
    """Table 9: who changed what and when, including Paystack payments (reference)."""
    __tablename__ = "audit_entries"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int | None = Field(default=None, foreign_key="users.id")
    listing_id: int | None = Field(default=None, foreign_key="listings.id", index=True)
    action: str  # create, update, publish, hide, payment...
    field_changed: str | None = None
    old_value: str | None = None
    new_value: str | None = None
    reference: str | None = None  # e.g. Paystack reference
    changed_at: datetime = Field(default_factory=utcnow)

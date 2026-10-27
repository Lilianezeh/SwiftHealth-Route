from datetime import datetime

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel

from app.models.base import utcnow


class FacilityOwner(SQLModel, table=True):
    """Table 10: which provider may edit (and, as an owner, pay for) which listing. FR-50, US-19.

    Added in accounts phase 6 after the owner's yes to decision D1 (2026-10-24). One row per listing and
    person: asking again after a removal sets the same row back to `pending` (the audit log keeps the
    history). `role` and `status` are plain text (`OwnerRole`, `LinkStatus` in models/base.py), not database
    enums, so a value never needs a migration. `note` is who staff reached on the phone to check the claim.
    """

    __tablename__ = "facility_owners"
    __table_args__ = (UniqueConstraint("listing_id", "user_id", name="uq_facility_owners_listing_user"),)

    id: int | None = Field(default=None, primary_key=True)
    listing_id: int = Field(foreign_key="listings.id", index=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    role: str = Field(default="owner")  # owner or manager
    status: str = Field(default="pending", index=True)  # pending, approved or removed
    requested_at: datetime = Field(default_factory=utcnow)
    approved_by: int | None = Field(default=None, foreign_key="users.id")
    approved_at: datetime | None = None
    removed_at: datetime | None = None
    removed_by: int | None = Field(default=None, foreign_key="users.id")
    note: str | None = None  # at most 300 characters (checked at the edge)

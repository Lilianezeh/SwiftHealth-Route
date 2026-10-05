from datetime import datetime

from sqlmodel import Field, SQLModel

from app.models.base import ReportReason, ReportStatus, utcnow


class UserReport(SQLModel, table=True):
    """Table 8: public problem reports. reporter_phone is deleted once resolved (NDPA)."""
    __tablename__ = "user_reports"

    id: int | None = Field(default=None, primary_key=True)
    listing_id: int = Field(foreign_key="listings.id", index=True)
    reason: ReportReason
    comment: str | None = None
    reporter_phone: str | None = None
    status: ReportStatus = Field(default=ReportStatus.open, index=True)
    created_at: datetime = Field(default_factory=utcnow)
    resolved_by: int | None = Field(default=None, foreign_key="users.id")
    resolved_at: datetime | None = None

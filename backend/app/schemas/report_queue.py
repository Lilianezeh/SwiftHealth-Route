"""Shapes of the staff report queue. See specs/backend/api-spec.md, "Phase 11 rules" under section 6.
Requirements: US-12, FR-35, NFR-07.
Decisions H1 to H3 and H7 in specs/2026-10-20-reports-queue/requirements.md.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.base import ListingStatus, ReportReason, ReportStatus


class ReportListingRef(BaseModel):
    """A small reference to the reported listing: enough to name it and link to it, whatever its status."""

    id: int
    slug: str
    name: str
    area: str
    status: ListingStatus


class ReportRead(BaseModel):
    id: int
    listing: ReportListingRef
    reason: ReportReason
    comment: str | None
    reporter_phone: str | None  # masked (+234******0000) while stored; null once the report is closed
    created_at: datetime
    status: ReportStatus
    urgent: bool
    resolved_at: datetime | None


class ReportList(BaseModel):
    items: list[ReportRead]
    total: int


class ReportQueueParams(BaseModel):
    status: ReportStatus = ReportStatus.open
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class ReportClose(BaseModel):
    """`open` is not a way to close a report, so it is not accepted."""

    status: Literal[ReportStatus.resolved, ReportStatus.dismissed]

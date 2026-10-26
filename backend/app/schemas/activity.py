"""Response shapes of the admin's activity log. See specs/backend/api-spec.md section 11, "Phase 4a" (FR-55).
The audit entry's `reference` column is not part of it: it can hold a Paystack reference."""

from datetime import datetime

from pydantic import BaseModel


class ActivityItem(BaseModel):
    id: int
    at: datetime
    user_id: int | None  # who did it (null: the nightly job, an anonymous submission)
    user_name: str | None
    action: str
    listing_id: int | None
    listing_name: str | None
    target_user_id: int | None  # the account a decision was about, when the entry says so
    target_user_name: str | None
    field_changed: str | None
    old_value: str | None
    new_value: str | None


class ActivityList(BaseModel):
    items: list[ActivityItem]
    total: int  # the entries that match the filters, not only this page

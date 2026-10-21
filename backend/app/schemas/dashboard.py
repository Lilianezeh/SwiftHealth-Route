"""Shape of GET /dashboard/stats. See specs/backend/api-spec.md, section 10 ("Phase 11 rules").
Requirements: US-11, FR-34. Decision H6 in specs/2026-10-20-reports-queue/requirements.md.
"""

from datetime import date

from pydantic import BaseModel


class CheckDay(BaseModel):
    date: date
    passed: int
    failed: int


class DashboardStats(BaseModel):
    listings_by_status: dict[str, int]  # all five statuses, 0 when none
    rechecks_due_this_week: int
    overdue_rechecks: int
    open_reports: int
    urgent_reports: int
    checks_last_30_days: list[CheckDay]  # one entry per Lagos day, oldest first
    featured_active: int

from datetime import datetime, timezone
from enum import Enum


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Role(str, Enum):
    verifier = "verifier"
    editor = "editor"
    admin = "admin"
    provider = "provider"


class ListingStatus(str, Enum):
    draft = "draft"
    pending_review = "pending_review"
    published = "published"
    recheck_due = "recheck_due"
    hidden = "hidden"


class CheckMethod(str, Enum):
    call = "call"
    visit = "visit"


class CheckResult(str, Enum):
    passed = "pass"
    failed = "fail"


class ReportReason(str, Enum):
    not_working = "not_working"
    wrong_number = "wrong_number"
    closed = "closed"
    moved = "moved"
    wrong_hours = "wrong_hours"
    other = "other"


class ReportStatus(str, Enum):
    open = "open"
    resolved = "resolved"
    dismissed = "dismissed"

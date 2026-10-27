from datetime import datetime, timezone
from enum import Enum


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Role(str, Enum):
    verifier = "verifier"
    editor = "editor"
    admin = "admin"
    provider = "provider"


class ApprovalStatus(str, Enum):
    """Whether an admin has let the account in. Plain text in `users.approval_status`, not a database enum."""

    pending = "pending"  # a staff sign-up waiting for an admin
    approved = "approved"  # accounts made before sign-up, accounts an admin makes, providers who signed up
    rejected = "rejected"


class OwnerRole(str, Enum):
    """What a provider may do through a facility link (decision D4). Plain text in `facility_owners.role`."""

    owner = "owner"  # edit the listing and pay for Featured
    manager = "manager"  # edit the listing only


class LinkStatus(str, Enum):
    """Where a facility link is. Plain text in `facility_owners.status`."""

    pending = "pending"  # asked for; staff have not phoned the facility yet
    approved = "approved"
    removed = "removed"  # rejected, or taken away later


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

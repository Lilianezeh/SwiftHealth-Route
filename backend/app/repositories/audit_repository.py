from datetime import datetime

from sqlmodel import Session

from app.models import AuditEntry


def add_entry(
    session: Session,
    *,
    user_id: int | None,
    listing_id: int | None,
    action: str,
    field_changed: str | None = None,
    old_value: str | None = None,
    new_value: str | None = None,
    reference: str | None = None,
    changed_at: datetime | None = None,
) -> AuditEntry:
    """Adds one audit row (FR-38). The caller commits, so the entry saves with the change it describes."""
    entry = AuditEntry(
        user_id=user_id, listing_id=listing_id, action=action, field_changed=field_changed,
        old_value=old_value, new_value=new_value, reference=reference,
    )
    if changed_at is not None:
        entry.changed_at = changed_at
    session.add(entry)
    session.flush()
    return entry

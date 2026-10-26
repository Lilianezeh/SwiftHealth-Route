"""The admin's activity log: who did what and when. Requirements: FR-55, FR-38, US-18.
Spec: specs/backend/api-spec.md section 11, "Phase 4a", `GET /admin/activity`.

Newest first, filtered by person, action and day, paged. Days are Africa/Lagos days and both ends are
included. An account decision names the account it was about in `reference` as `user:{id}`; that is turned
into the account's id and name here, and no other `reference` (it can be a Paystack reference) ever leaves
this service.
"""

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlmodel.ext.asyncio.session import AsyncSession

from app.repositories import audit_repository, user_repository
from app.schemas.activity import ActivityItem, ActivityList

LAGOS = ZoneInfo("Africa/Lagos")
ACCOUNT_REFERENCE = "user:"


def _start_of_day(day: date) -> datetime:
    return datetime.combine(day, time.min, tzinfo=LAGOS).astimezone(timezone.utc)


def _target_id(reference: str | None) -> int | None:
    """The account id of a `user:{id}` reference, else None."""
    if reference is None or not reference.startswith(ACCOUNT_REFERENCE):
        return None
    number = reference[len(ACCOUNT_REFERENCE):]
    return int(number) if number.isdigit() else None


async def list_activity(
    session: AsyncSession,
    *,
    user_id: int | None,
    action: str | None,
    first_day: date | None,
    last_day: date | None,
    limit: int,
    offset: int,
) -> ActivityList:
    rows, total = await audit_repository.list_activity(
        session,
        user_id=user_id,
        action=action,
        start=_start_of_day(first_day) if first_day else None,
        end=_start_of_day(last_day + timedelta(days=1)) if last_day else None,
        limit=limit,
        offset=offset,
    )
    wanted = {_target_id(entry.reference) for entry, _actor, _listing in rows}
    target_names = await user_repository.names_by_ids(
        session, {number for number in wanted if number is not None}
    )
    items = []
    for entry, actor_name, listing_name in rows:
        target_id = _target_id(entry.reference)
        items.append(
            ActivityItem(
                id=entry.id,  # type: ignore[arg-type]  # a saved row has an id
                at=entry.changed_at,
                user_id=entry.user_id,
                user_name=actor_name,
                action=entry.action,
                listing_id=entry.listing_id,
                listing_name=listing_name,
                target_user_id=target_id if target_id in target_names else None,
                target_user_name=target_names.get(target_id) if target_id is not None else None,
                field_changed=entry.field_changed,
                old_value=entry.old_value,
                new_value=entry.new_value,
            )
        )
    return ActivityList(items=items, total=total)

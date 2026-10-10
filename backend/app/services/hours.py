"""Open now in Lagos time, and the next opening or closing time.
Requirements: US-01, FR-05, FR-06; decisions 7 to 9 in specs/2026-10-09-search-backend/ and the feature in
specs/2026-10-10-next-open-close-time/.

Pure logic, so plain `def` (no database, no waiting). The moment is passed in, never read from the clock here.
"""
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

from app.models import OpeningHours

LAGOS_TIME = ZoneInfo("Africa/Lagos")


def runs_past_midnight(row: OpeningHours) -> bool:
    return row.opens_at is not None and row.closes_at is not None and row.closes_at < row.opens_at


def is_open_on_own_day(row: OpeningHours, now: time) -> bool:
    """True if this day's own hours include `now`. A shift past midnight counts only until midnight here."""
    if row.is_closed or row.opens_at is None or row.closes_at is None:
        return False
    if runs_past_midnight(row):  # e.g. 20:00-02:00: open from 20:00 until midnight
        return now >= row.opens_at
    return row.opens_at <= now < row.closes_at  # opens == closes is zero-length: never open


def is_open_at(opening_hours: Iterable[OpeningHours], is_24_hours: bool, moment: datetime) -> bool:
    """True if the listing is open at `moment`. day_of_week 0 is Monday; a missing day means closed."""
    if moment.tzinfo is None:
        raise ValueError("The moment needs a time zone, or it cannot be converted to Lagos time.")
    if is_24_hours:  # always open, with no 23:59 gap
        return True

    lagos_moment = moment.astimezone(LAGOS_TIME)
    today = lagos_moment.weekday()
    yesterday = (today - 1) % 7  # Monday's "yesterday" is Sunday (6)
    hours_by_day = {row.day_of_week: row for row in opening_hours}

    today_row = hours_by_day.get(today)
    if today_row is not None and is_open_on_own_day(today_row, lagos_moment.time()):
        return True

    yesterday_row = hours_by_day.get(yesterday)  # a late shift that started yesterday may still be running
    if yesterday_row is None or yesterday_row.is_closed or not runs_past_midnight(yesterday_row):
        return False
    return lagos_moment.time() < yesterday_row.closes_at


# --- the next opening or closing time (specs/2026-10-10-next-open-close-time/) ---
# Requirements: FR-06, US-01, FR-05.

DAY_NAMES = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
# A weekly schedule repeats, so the next change is always within 7 days (or there is none):
# yesterday plus 8 days is enough.
DAYS_SEARCHED = 9


@dataclass(frozen=True)
class NextChange:
    """What happens next: the listing "opens" or "closes", and when (in Lagos time)."""

    kind: Literal["opens", "closes"]
    at: datetime


def has_usable_times(row: OpeningHours | None) -> bool:
    """False for a missing day, a closed day, a day without times and a zero-length day.

    A zero-length day (opens equals closes) is never open, like in `is_open_at`.
    """
    return (
        row is not None and not row.is_closed and row.opens_at is not None
        and row.closes_at is not None and row.opens_at != row.closes_at
    )


def open_intervals(
    opening_hours: Iterable[OpeningHours], first_day: date, days: int
) -> list[tuple[datetime, datetime]]:
    """The times the listing is open on `days` days from `first_day`, in order. Shifts that touch are one.

    A shift that ends at 00:00 followed by a day that starts at 00:00 is one opening, so the note names
    the end of the whole run, not the midnight in the middle.
    """
    hours_by_day = {row.day_of_week: row for row in opening_hours}
    intervals: list[tuple[datetime, datetime]] = []
    for offset in range(days):
        day = first_day + timedelta(days=offset)
        row = hours_by_day.get(day.weekday())
        if row is None or not has_usable_times(row):
            continue
        closing_day = day + timedelta(days=1) if runs_past_midnight(row) else day
        opens = datetime.combine(day, row.opens_at, tzinfo=LAGOS_TIME)
        closes = datetime.combine(closing_day, row.closes_at, tzinfo=LAGOS_TIME)
        if intervals and opens <= intervals[-1][1]:
            intervals[-1] = (intervals[-1][0], max(intervals[-1][1], closes))
        else:
            intervals.append((opens, closes))
    return intervals


def next_change(
    opening_hours: Iterable[OpeningHours], is_24_hours: bool, moment: datetime
) -> NextChange | None:
    """When the listing next closes (if it is open at `moment`) or opens (if it is closed).

    None when there is no such time: a 24-hour listing, or a listing with no hours recorded (no rows, only
    closed days, rows without times).
    """
    if moment.tzinfo is None:
        raise ValueError("The moment needs a time zone, or it cannot be converted to Lagos time.")
    if is_24_hours:
        return None

    lagos_moment = moment.astimezone(LAGOS_TIME)
    # Start from yesterday, because a shift that began yesterday may still be running.
    first_day = lagos_moment.date() - timedelta(days=1)
    for opens, closes in open_intervals(opening_hours, first_day, DAYS_SEARCHED):
        if opens <= lagos_moment < closes:
            return NextChange("closes", closes)
        if opens > lagos_moment:
            return NextChange("opens", opens)
    return None


def format_clock_time(moment: datetime) -> str:
    """"9:00 PM", "7:30 AM", "12:30 PM": 12-hour, minutes always, no leading zero. Seconds are left out."""
    hour = moment.hour % 12 or 12
    return f"{hour}:{moment.minute:02d} {'AM' if moment.hour < 12 else 'PM'}"


def describe_next_change(change: NextChange, moment: datetime) -> str:
    """"Closes 9:00 PM", "Closes 2:00 AM tomorrow", "Opens 7:30 AM", "Opens Monday 7:30 AM".

    English only (owner's decision, see LOG.md). The day is left out for a change later today, is "tomorrow"
    for the next Lagos date, and is the full day name after that. Midnight is written "at midnight", never
    "12:00 AM"; midnight at the start of tomorrow is the coming midnight, so it has no day word.
    """
    verb = "Closes" if change.kind == "closes" else "Opens"
    days_ahead = (change.at.date() - moment.astimezone(LAGOS_TIME).date()).days
    is_midnight = change.at.hour == 0 and change.at.minute == 0
    clock = "at midnight" if is_midnight else format_clock_time(change.at)

    if days_ahead <= 0 or (days_ahead == 1 and is_midnight):
        return f"{verb} {clock}"
    if days_ahead == 1:
        return f"{verb} {clock} tomorrow"
    return f"{verb} {DAY_NAMES[change.at.weekday()]} {clock}"


def hours_note(opening_hours: Iterable[OpeningHours], is_24_hours: bool, moment: datetime) -> str | None:
    """The short text for a search result, or None (see `next_change`). It always agrees with `is_open_at`."""
    change = next_change(opening_hours, is_24_hours, moment)
    return None if change is None else describe_next_change(change, moment)

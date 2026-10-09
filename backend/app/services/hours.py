"""Open now in Lagos time. Requirements: US-01, FR-05; decisions 7 to 9 in specs/2026-10-09-search-backend/.

Pure logic, so plain `def` (no database, no waiting). The moment is passed in, never read from the clock here.
"""
from collections.abc import Iterable
from datetime import datetime, time
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

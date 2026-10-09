"""Open now in Lagos time. Requirements: US-01, FR-05 (open now, open 24 hours), roadmap phase 5a.

Decisions 7 to 9 in specs/2026-10-09-search-backend/requirements.md. Plain OpeningHours objects are enough: no
database is involved. 2026-10-05 is a Monday, so day_of_week 0 is that date and 6 is 2026-10-11.
"""
from datetime import datetime, time, timedelta, timezone

import pytest

from app.models import OpeningHours
from app.services.hours import LAGOS_TIME, is_open_at

MONDAY, TUESDAY, WEDNESDAY, SATURDAY, SUNDAY = 0, 1, 2, 5, 6


def lagos_moment(day: int, hour: int, minute: int = 0, second: int = 0) -> datetime:
    """A moment in Lagos time on the given weekday (day 0 is Monday 2026-10-05)."""
    return datetime(2026, 10, 5 + day, hour, minute, second, tzinfo=LAGOS_TIME)


def hours_for(
    day: int, opens_at: time | None, closes_at: time | None, is_closed: bool = False
) -> OpeningHours:
    return OpeningHours(
        listing_id=1, day_of_week=day, opens_at=opens_at, closes_at=closes_at, is_closed=is_closed
    )


def every_day(opens_at: time, closes_at: time) -> list[OpeningHours]:
    return [hours_for(day, opens_at, closes_at) for day in range(7)]


def test_open_during_normal_hours() -> None:
    opening_hours = every_day(time(8, 0), time(21, 0))
    assert is_open_at(opening_hours, False, lagos_moment(TUESDAY, 10, 0))


def test_open_at_the_opening_minute_and_closed_at_the_closing_minute() -> None:
    opening_hours = every_day(time(8, 0), time(21, 0))
    assert is_open_at(opening_hours, False, lagos_moment(TUESDAY, 8, 0))
    assert not is_open_at(opening_hours, False, lagos_moment(TUESDAY, 21, 0))
    assert is_open_at(opening_hours, False, lagos_moment(TUESDAY, 20, 59, 59))


def test_closed_before_opening_and_after_closing() -> None:
    opening_hours = every_day(time(8, 0), time(21, 0))
    assert not is_open_at(opening_hours, False, lagos_moment(TUESDAY, 7, 59))
    assert not is_open_at(opening_hours, False, lagos_moment(TUESDAY, 23, 0))
    assert not is_open_at(opening_hours, False, lagos_moment(TUESDAY, 0, 0))


def test_past_midnight_shift_open_at_2300() -> None:
    opening_hours = every_day(time(22, 0), time(6, 0))
    assert is_open_at(opening_hours, False, lagos_moment(TUESDAY, 23, 0))
    assert is_open_at(opening_hours, False, lagos_moment(TUESDAY, 22, 0))
    assert not is_open_at(opening_hours, False, lagos_moment(TUESDAY, 21, 59))


def test_past_midnight_shift_open_at_0300_through_yesterdays_row() -> None:
    opening_hours = every_day(time(22, 0), time(6, 0))
    assert is_open_at(opening_hours, False, lagos_moment(WEDNESDAY, 3, 0))
    assert is_open_at(opening_hours, False, lagos_moment(WEDNESDAY, 5, 59))


def test_past_midnight_shift_closed_after_it_ends() -> None:
    opening_hours = every_day(time(20, 0), time(2, 0))
    assert is_open_at(opening_hours, False, lagos_moment(WEDNESDAY, 1, 30))
    assert not is_open_at(opening_hours, False, lagos_moment(WEDNESDAY, 2, 0))
    assert not is_open_at(opening_hours, False, lagos_moment(WEDNESDAY, 3, 0))
    assert not is_open_at(opening_hours, False, lagos_moment(WEDNESDAY, 7, 0))


def test_sunday_night_shift_is_still_open_on_monday_morning() -> None:
    # Monday's "yesterday" is Sunday (6), so the week wraps.
    opening_hours = [hours_for(SUNDAY, time(22, 0), time(6, 0))]
    monday_morning = lagos_moment(MONDAY, 3, 0) + timedelta(days=7)  # Monday 2026-10-12
    assert monday_morning.weekday() == MONDAY
    assert is_open_at(opening_hours, False, monday_morning)
    assert not is_open_at(opening_hours, False, monday_morning.replace(hour=7))


def test_a_closed_day_does_not_open_the_next_morning() -> None:
    opening_hours = [
        hours_for(MONDAY, None, None, is_closed=True),
        hours_for(TUESDAY, time(8, 0), time(21, 0)),
    ]
    assert not is_open_at(opening_hours, False, lagos_moment(TUESDAY, 1, 0))


def test_a_shift_that_started_on_a_day_marked_closed_does_not_carry_over() -> None:
    # The row says closed, even though it still holds old hours: the closed flag wins.
    opening_hours = [hours_for(MONDAY, time(22, 0), time(6, 0), is_closed=True)]
    assert not is_open_at(opening_hours, False, lagos_moment(MONDAY, 23, 0))
    assert not is_open_at(opening_hours, False, lagos_moment(TUESDAY, 3, 0))


def test_is_closed_row_is_closed_all_day() -> None:
    opening_hours = [hours_for(TUESDAY, time(8, 0), time(21, 0), is_closed=True)]
    assert not is_open_at(opening_hours, False, lagos_moment(TUESDAY, 10, 0))


def test_missing_day_row_is_closed() -> None:
    opening_hours = [hours_for(MONDAY, time(8, 0), time(21, 0))]
    assert not is_open_at(opening_hours, False, lagos_moment(TUESDAY, 10, 0))
    assert not is_open_at([], False, lagos_moment(TUESDAY, 10, 0))


def test_a_row_without_times_is_closed() -> None:
    opening_hours = [hours_for(TUESDAY, None, None)]
    assert not is_open_at(opening_hours, False, lagos_moment(TUESDAY, 10, 0))


def test_hours_with_the_same_opening_and_closing_time_are_closed() -> None:
    opening_hours = every_day(time(8, 0), time(8, 0))
    assert not is_open_at(opening_hours, False, lagos_moment(TUESDAY, 8, 0))
    assert not is_open_at(opening_hours, False, lagos_moment(TUESDAY, 12, 0))


@pytest.mark.parametrize("hour, minute, second", [(0, 0, 0), (12, 0, 0), (23, 59, 0), (23, 59, 30)])
def test_24_hour_listing_is_always_open(hour: int, minute: int, second: int) -> None:
    # Even with no hours rows, and even with rows that end at 23:59 (the old gap).
    assert is_open_at([], True, lagos_moment(TUESDAY, hour, minute, second))
    assert is_open_at(every_day(time(0, 0), time(23, 59)), True, lagos_moment(TUESDAY, hour, minute, second))


def test_a_listing_with_hours_to_23_59_but_no_24_hour_flag_closes_at_23_59() -> None:
    opening_hours = every_day(time(0, 0), time(23, 59))
    assert is_open_at(opening_hours, False, lagos_moment(TUESDAY, 23, 58))
    assert not is_open_at(opening_hours, False, lagos_moment(TUESDAY, 23, 59, 30))


def test_uses_lagos_time_not_utc() -> None:
    # Monday 23:30 UTC is Tuesday 00:30 in Lagos (UTC+1), the server clock is UTC on Render.
    moment_in_utc = datetime(2026, 10, 5, 23, 30, tzinfo=timezone.utc)
    tuesday_only = [hours_for(TUESDAY, time(0, 0), time(6, 0))]
    # Open at 23:30 on Monday, so it would wrongly be open if we read the UTC clock.
    monday_only = [hours_for(MONDAY, time(20, 0), time(23, 45))]
    assert is_open_at(tuesday_only, False, moment_in_utc)
    assert not is_open_at(monday_only, False, moment_in_utc)


def test_a_moment_in_another_time_zone_is_converted() -> None:
    opening_hours = every_day(time(8, 0), time(21, 0))
    utc_moment = datetime(2026, 10, 6, 9, 0, tzinfo=timezone.utc)  # 10:00 in Lagos: open
    same_instant_elsewhere = utc_moment.astimezone(timezone(timedelta(hours=5)))  # 14:00 in UTC+5
    assert is_open_at(opening_hours, False, utc_moment)
    assert is_open_at(opening_hours, False, same_instant_elsewhere)
    late_utc = datetime(2026, 10, 6, 20, 30, tzinfo=timezone.utc)  # 21:30 in Lagos: closed
    assert not is_open_at(opening_hours, False, late_utc)
    assert not is_open_at(opening_hours, False, late_utc.astimezone(timezone(timedelta(hours=-8))))


def test_a_moment_without_a_time_zone_is_refused() -> None:
    opening_hours = every_day(time(8, 0), time(21, 0))
    with pytest.raises(ValueError, match="time zone"):
        is_open_at(opening_hours, False, datetime(2026, 10, 6, 10, 0))

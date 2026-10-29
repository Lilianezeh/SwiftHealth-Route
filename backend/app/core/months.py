"""Calendar months, for the owner fee (specs/2026-10-29-owner-fee/, question Q2: a month, not 30 days)."""

import calendar
from datetime import datetime


def add_one_month(moment: datetime) -> datetime:
    """The same day and time one calendar month later; when that month is shorter, its last day.

    2026-01-31 becomes 2026-02-28, 2028-01-31 becomes 2028-02-29, 2026-12-15 becomes 2027-01-15.
    Plain `def`: it only does arithmetic on a value in memory."""
    year, month = (moment.year, moment.month + 1) if moment.month < 12 else (moment.year + 1, 1)
    last_day = calendar.monthrange(year, month)[1]
    return moment.replace(year=year, month=month, day=min(moment.day, last_day))

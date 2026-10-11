"""The one rule for "verification due". Requirements: FR-08, NFR-08, US-07.

A published listing that is past its re-check date is still shown, with `verification_due: true`, until the
nightly job (phase 11b) hides it. Search results and the listing page both ask here, so they cannot disagree.
"""
from datetime import datetime


def is_verification_due(next_check_due: datetime | None, moment: datetime) -> bool:
    """True once the re-check date has passed. No date means nothing is due; the exact moment is not yet due.

    `moment` is passed in (never read from the clock here), so tests can choose the time.
    """
    return next_check_due is not None and next_check_due < moment

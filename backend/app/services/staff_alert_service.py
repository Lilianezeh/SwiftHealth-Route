"""Tells the staff that a listing was flagged for an urgent re-check. Requirements: FR-22, NFR-07.

Editors and admins get an email (Resend), admins also get an SMS (Termii). The texts hold the listing
name only: never the comment, the reporter's phone or anything else about the reporter. Sending is best
effort: a failure is logged without any address or number and never reaches the visitor whose report
caused it. With no key nothing is sent (the integrations log that).
Decision B6 in specs/2026-10-20-reports/requirements.md.
"""

import logging
from dataclasses import dataclass

from sqlmodel.ext.asyncio.session import AsyncSession

from app.integrations import resend, termii
from app.models.base import Role
from app.repositories import user_repository

logger = logging.getLogger(__name__)

REPORTS_TO_FLAG = 2  # FR-22, named in the text so the text always agrees with the rule


@dataclass(frozen=True)
class StaffAlert:
    """What to send and to whom. Loaded during the request: the session is closed once the answer is sent."""

    listing_name: str
    editor_emails: list[str]
    admin_phones: list[str]
    kind: str = "flag"  # "flag" (two reporters, FR-22) or "failed_check" (a failed re-check hid it, FR-36)


def build_failed_check_texts(listing_name: str) -> tuple[str, str]:
    """The email subject and body for a published listing that failed a check and was hidden (FR-36)."""
    subject = f"Failed check, now hidden: {listing_name}"
    body = (
        f"{listing_name} failed a check and was hidden from the public. "
        "Open the listing to read the check, then fix it, re-check it or leave it hidden."
    )
    return subject, body


def build_alert_texts(listing_name: str) -> tuple[str, str, str]:
    """The email subject, the email body and the SMS."""
    subject = f"Urgent re-check: {listing_name}"
    body = (
        f"{listing_name} was reported as not working by {REPORTS_TO_FLAG} different people within 7 days. "
        "It is hidden from the public until it is re-checked. Open the report queue to look at it."
    )
    sms = (
        f"SwiftHealth Route: {listing_name} was reported not working by {REPORTS_TO_FLAG} people "
        "and is hidden. Re-check it."
    )
    return subject, body, sms


async def load_alert(session: AsyncSession, listing_name: str) -> StaffAlert:
    """Finds who to tell: every active editor and admin with an email, every active admin with a phone."""
    staff = await user_repository.list_active_with_roles(session, {Role.editor, Role.admin})
    return StaffAlert(
        listing_name=listing_name,
        editor_emails=[user.email for user in staff],
        admin_phones=[user.phone for user in staff if user.role == Role.admin and user.phone],
    )


async def load_failed_check_alert(session: AsyncSession, listing_name: str) -> StaffAlert:
    """The editors and admins by email only: a failed check sends no SMS (decision C9)."""
    staff = await user_repository.list_active_with_roles(session, {Role.editor, Role.admin})
    return StaffAlert(
        listing_name=listing_name,
        editor_emails=[user.email for user in staff],
        admin_phones=[],
        kind="failed_check",
    )


MAX_NAMES_IN_EMAIL = 50  # a long list is cut, with "and N more"


@dataclass(frozen=True)
class RecheckSummary:
    """The nightly job's email: how many listings moved to re-check due, and which (names only, FR-33)."""

    listing_names: list[str]
    editor_emails: list[str]


def build_recheck_summary_texts(listing_names: list[str]) -> tuple[str, str]:
    """The email subject and body of the nightly job. Names only: nothing about any person."""
    count = len(listing_names)
    noun = "listing" if count == 1 else "listings"
    subject = f"Re-check due: {count} {noun} moved"
    shown = listing_names[:MAX_NAMES_IN_EMAIL]
    lines = [f"{count} {noun} passed the check date and moved to re-check due, hidden from the public:", ""]
    lines += [f"- {name}" for name in shown]
    if count > len(shown):
        lines.append(f"- and {count - len(shown)} more")
    lines += ["", "Open the Re-checks screen to see them. Check each one, then publish it again."]
    return subject, "\n".join(lines)


async def load_recheck_summary(session: AsyncSession, listing_names: list[str]) -> RecheckSummary:
    """Finds who to tell: every active editor and admin."""
    staff = await user_repository.list_active_with_roles(session, {Role.editor, Role.admin})
    return RecheckSummary(listing_names=listing_names, editor_emails=[user.email for user in staff])


async def send_recheck_summary(summary: RecheckSummary) -> None:
    """Sends the nightly email to everyone. One failure never stops the others, and nothing here raises."""
    subject, body = build_recheck_summary_texts(summary.listing_names)
    for email in summary.editor_emails:
        try:
            await resend.send_email(email, subject, body)
        except resend.EmailSendError as error:
            logger.warning("Re-check summary email failed: %s", error)


async def alert_two_factor_locked(session: AsyncSession, account_name: str) -> None:
    """Tells the admins that an account's second login step is locked for an hour (FR-58). Nothing raises.

    The text holds the person's name and nothing else about the account: no email, no code. The password
    alone does not log anyone in, so this is a notice, not an emergency.
    """
    subject = "A second login step was locked"
    body = (
        f"The authenticator codes of {account_name} were wrong 10 times in an hour, so that second step "
        "is locked until the hour ends. If it was not them, nothing needs doing: a password alone does "
        "not log anyone in. If it was them, they can use a backup code or ask an admin to reset it."
    )
    for admin in await user_repository.list_active_with_roles(session, {Role.admin}):
        try:
            await resend.send_email(admin.email, subject, body)
        except resend.EmailSendError as error:
            logger.warning("Two-factor lock email failed: %s", error)


async def send_alerts(alert: StaffAlert) -> None:
    """Sends every message. One failure never stops the others, and nothing here raises."""
    if alert.kind == "failed_check":
        subject, body = build_failed_check_texts(alert.listing_name)
        sms = ""
    else:
        subject, body, sms = build_alert_texts(alert.listing_name)
    for email in alert.editor_emails:
        try:
            await resend.send_email(email, subject, body)
        except resend.EmailSendError as error:
            logger.warning("Staff alert email failed: %s", error)
    for phone in alert.admin_phones:
        try:
            await termii.send_sms(phone, sms)
        except termii.SmsSendError as error:
            logger.warning("Staff alert SMS failed: %s", error)

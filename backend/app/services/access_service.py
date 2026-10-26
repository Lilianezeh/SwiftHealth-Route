"""Who may edit which listing. Requirements: FR-30, FR-50, NFR-06 (role-based access). Auth decision 7.

Editor and admin: any listing. Verifier: only a draft they created. Provider: only a listing they have an
APPROVED owner link to (`facility_owners`, accounts phase 6a); `listings.owner_id` is no longer read.
"""
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import Listing, User
from app.models.base import ListingStatus, Role
from app.repositories import facility_owner_repository, listing_repository


class NotAllowedError(Exception):
    """This user's role does not allow this action on this listing."""


class ListingNotFoundError(Exception):
    """No listing has this id."""


def ensure_can_edit_listing(user: User, listing: Listing) -> None:
    """Returns quietly when the user may edit the listing by role alone, otherwise raises NotAllowedError.

    A provider is never allowed by this check: their access comes from a link in the database, which
    `ensure_can_edit` (below) looks up. Plain `def`: it only compares values already in memory (decision 11).
    """
    if user.role in (Role.editor, Role.admin):
        return
    if user.role == Role.verifier:
        created_it = listing.created_by is not None and listing.created_by == user.id
        if created_it and listing.status == ListingStatus.draft:
            return
    raise NotAllowedError


async def ensure_can_edit(session: AsyncSession, user: User, listing: Listing) -> None:
    """Like `ensure_can_edit_listing`, and a provider is allowed with an approved link (a query)."""
    if user.role == Role.provider:
        if await facility_owner_repository.has_approved_link(session, listing.id, user.id):  # type: ignore[arg-type]
            return
        raise NotAllowedError
    ensure_can_edit_listing(user, listing)


async def load_listing_for_editing(session: AsyncSession, user: User, listing_id: int) -> Listing:
    """Loads the listing and checks the user may edit it. Awaits the database, so it is async."""
    listing = await listing_repository.get_by_id(session, listing_id)
    if listing is None:
        raise ListingNotFoundError
    await ensure_can_edit(session, user, listing)
    return listing

"""Who may edit which listing. Requirements: FR-30, NFR-06 (role-based access). Auth decision 7.

Editor and admin: any listing. Verifier: only a draft they created. Provider: only the listing they own.
"""
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import Listing, User
from app.models.base import ListingStatus, Role
from app.repositories import listing_repository


class NotAllowedError(Exception):
    """This user's role does not allow this action on this listing."""


class ListingNotFoundError(Exception):
    """No listing has this id."""


def ensure_can_edit_listing(user: User, listing: Listing) -> None:
    """Returns quietly when the user may edit the listing, otherwise raises NotAllowedError.

    Plain `def`: it only compares values already in memory (decision 11).
    """
    if user.role in (Role.editor, Role.admin):
        return
    if user.role == Role.verifier:
        created_it = listing.created_by is not None and listing.created_by == user.id
        if created_it and listing.status == ListingStatus.draft:
            return
    if user.role == Role.provider:
        if listing.owner_id is not None and listing.owner_id == user.id:
            return
    raise NotAllowedError


async def load_listing_for_editing(session: AsyncSession, user: User, listing_id: int) -> Listing:
    """Loads the listing and checks the user may edit it. Awaits the database, so it is async."""
    listing = await listing_repository.get_by_id(session, listing_id)
    if listing is None:
        raise ListingNotFoundError
    ensure_can_edit_listing(user, listing)
    return listing

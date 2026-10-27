"""Who may edit which listing. Requirements: FR-30, FR-50, NFR-06 (role-based access). Auth decision 7.

Editor and admin: any listing. Verifier: only a draft they created. Provider: only a listing they have an
APPROVED owner link to (`facility_owners`, accounts phase 6a); `listings.owner_id` is no longer read.
"""
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import Listing, User
from app.models.base import ListingStatus, OwnerRole, Role
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


async def ensure_can_close(session: AsyncSession, user: User, listing: Listing) -> None:
    """Who may close a facility: an editor or admin, or a provider with an approved link whose role is `owner`
    (a manager may edit and move a facility but not close it, accounts phase 8a)."""
    if user.role == Role.provider:
        found = await facility_owner_repository.approved_link_for(session, user.id, listing.id)  # type: ignore[arg-type]
        if found is None or found[0].role != OwnerRole.owner.value:
            raise NotAllowedError
        return
    ensure_can_edit_listing(user, listing)


async def ensure_can_read_history(session: AsyncSession, user: User, listing: Listing) -> None:
    """Who may read the address history: any staff role, or a provider with an approved link."""
    if user.role == Role.provider:
        if not await facility_owner_repository.has_approved_link(session, listing.id, user.id):  # type: ignore[arg-type]
            raise NotAllowedError
        return
    if user.role not in (Role.verifier, Role.editor, Role.admin):
        raise NotAllowedError


async def load_listing_for_editing(session: AsyncSession, user: User, listing_id: int) -> Listing:
    """Loads the listing and checks the user may edit it. Awaits the database, so it is async."""
    listing = await listing_repository.get_by_id(session, listing_id)
    if listing is None:
        raise ListingNotFoundError
    await ensure_can_edit(session, user, listing)
    return listing

"""The rules for a branch of a facility. Requirements: FR-52, US-20.
Spec: specs/backend/api-spec.md section 7, "Phase 8b"; decision D5 of
specs/2026-10-23-accounts-and-facility-ownership/.

One level only: a branch points to a main facility, and a main facility is not itself a branch. The
branch is of the same category as its main facility (the project has no category families). A closed
main facility gets no new branch. No HTTP: the routes turn `BranchRuleError` into a 422 with its sentence.
"""

from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import Listing
from app.repositories import listing_repository


class BranchRuleError(Exception):
    """A rule for branches is broken. `str(error)` is the sentence for the person."""


async def ensure_can_be_branch_of(session: AsyncSession, child: Listing | None, parent_id: int) -> Listing:
    """Checks that `child` (None for a branch that does not exist yet) may become a branch of `parent_id` and
    returns the main facility. Raises `BranchRuleError` with the sentence that says which rule is broken."""
    if child is not None and child.id == parent_id:
        raise BranchRuleError("A facility cannot be its own parent.")
    parent = await listing_repository.get_by_id(session, parent_id)
    if parent is None:
        raise BranchRuleError("No such main facility.")
    if parent.parent_id is not None:
        raise BranchRuleError("A branch cannot have its own branches.")
    child_has_branches = child is not None and await listing_repository.has_branches(
        session, child.id  # type: ignore[arg-type]
    )
    if child_has_branches:
        raise BranchRuleError("This listing has branches, so it cannot be a branch.")
    if parent.closed_at is not None:
        raise BranchRuleError("A closed facility cannot have branches.")
    if child is not None and child.category_id != parent.category_id:
        raise BranchRuleError("A branch must be the same kind of facility as its main facility.")
    return parent

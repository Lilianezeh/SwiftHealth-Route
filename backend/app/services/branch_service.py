"""A provider adds a branch to their facility and lists its branches. Requirements: FR-52, US-20, NFR-07.
Spec: specs/backend/api-spec.md section 7, "Phase 8b"; decision D5 of
specs/2026-10-23-accounts-and-facility-ownership/.

The branch is a draft listing of its own with `parent_id` set; staff verify and publish it on its own.
It gets no owner link: the owner of the main facility reaches it through the main facility (access
inherits, one way, in `facility_owner_repository`). It takes its main facility's category. The duplicate
check looks only inside the facility: the same phone number or the same address on the main facility or
on one of its branches. The rules for what may be a branch are in `branch_rules`. No HTTP: the routes
turn the domain errors into status codes.
"""

from datetime import datetime

from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import DEFAULT_MAP_CENTRE
from app.models import Listing, PhoneNumber, User
from app.models.base import ListingStatus
from app.repositories import audit_repository, facility_owner_repository, listing_repository
from app.schemas.facility_registration import BranchCreate, BranchCreated, BranchItem, BranchList
from app.services import branch_rules
from app.services.staff_listing_service import SUBMISSION_ACTION, unique_slug

BRANCH_THANKS = "Thanks. Our team will verify the branch before it is listed."
BRANCH_ALREADY_REGISTERED = "This branch is already registered. Please contact us."


class NoAccessToMainFacilityError(Exception):
    """The person has no approved link on the main facility. The route answers 404 (nothing is revealed)."""


class BranchDuplicateError(Exception):
    """The phone number or the address is already on the main facility or one of its branches (409)."""


async def _main_facility_of_the_caller(session: AsyncSession, user: User, main_id: int) -> Listing:
    user_id: int = user.id  # type: ignore[assignment]
    found = await facility_owner_repository.approved_link_for(session, user_id, main_id)
    if found is None:
        raise NoAccessToMainFacilityError
    return found[1]


async def create_branch(
    session: AsyncSession, user: User, main_id: int, payload: BranchCreate, moment: datetime
) -> BranchCreated:
    main = await _main_facility_of_the_caller(session, user, main_id)
    await branch_rules.ensure_can_be_branch_of(session, None, main.id)  # type: ignore[arg-type]
    duplicate = await listing_repository.find_in_facility_by_phone_or_address(
        session, main.id, payload.phone, payload.address  # type: ignore[arg-type]
    )
    if duplicate is not None:
        raise BranchDuplicateError
    listing = Listing(
        slug=await unique_slug(session, payload.facility_name, payload.area),
        name=payload.facility_name,
        category_id=main.category_id,
        area=payload.area,
        address=payload.address,
        latitude=DEFAULT_MAP_CENTRE[0],
        longitude=DEFAULT_MAP_CENTRE[1],
        status=ListingStatus.draft,
        created_by=None,
        parent_id=main.id,
        created_at=moment,
        updated_at=moment,
    )
    phone = PhoneNumber(listing_id=0, number=payload.phone, is_primary=True)
    await listing_repository.add_listing_with_details(session, listing, [phone], [], [])
    await audit_repository.add_entry(
        session,
        user_id=user.id,
        listing_id=listing.id,
        action="create",
        reference=f"branch-of:{main.id}",
        changed_at=moment,
    )
    if payload.notes:
        # Staff-only, like the notes of the old open form: shown in the editor's "submission details".
        await audit_repository.add_entry(
            session,
            user_id=user.id,
            listing_id=listing.id,
            action=SUBMISSION_ACTION,
            field_changed="notes",
            new_value=f"Notes: {payload.notes}",
            changed_at=moment,
        )
    await session.commit()
    return BranchCreated(message=BRANCH_THANKS, listing_id=listing.id)  # type: ignore[arg-type]


async def list_branches(session: AsyncSession, user: User, main_id: int) -> BranchList:
    main = await _main_facility_of_the_caller(session, user, main_id)
    main_id_checked: int = main.id  # type: ignore[assignment]
    branches = await listing_repository.list_branches(session, main_id_checked, published_only=False)
    return BranchList(
        items=[
            BranchItem(
                id=branch.id,  # type: ignore[arg-type]
                name=branch.name,
                area=branch.area,
                status=branch.status.value,
            )
            for branch in branches
        ]
    )

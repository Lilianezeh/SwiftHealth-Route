"""A provider's own facility. HTTP only: the rules are in services/provider_service.py.
Contract: specs/backend/api-spec.md, section 7 (FR-43)."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import (
    branch_rate_limit,
    claim_rate_limit,
    claimable_search_rate_limit,
    get_current_moment,
    get_session,
    require_role,
    submission_rate_limit,
)
from app.models import User
from app.models.base import Role
from app.schemas.facility_registration import (
    BranchCreate,
    BranchCreated,
    BranchList,
    ClaimableList,
    ClaimCreate,
    ClaimCreated,
    FacilityRegister,
    FacilityRegistered,
)
from app.schemas.owner_link import OwnerList
from app.schemas.provider import ProviderListing, ProviderListingUpdate
from app.services import (
    branch_rules,
    branch_service,
    facility_registration_service,
    owner_link_service,
    provider_service,
)

router = APIRouter(prefix="/provider", tags=["Providers"])

NO_LISTING = "No listing is linked to your account."


@router.post(
    "/facilities",
    response_model=FacilityRegistered,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(submission_rate_limit)],
    summary="Provider: register a new facility (a draft and a pending owner link for staff to check)",
    responses={409: {"description": "A listing like this exists. `detail` has `message` and `listing_id`."}},
)
async def register_facility(
    payload: FacilityRegister,
    provider: User = Depends(require_role(Role.provider)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> FacilityRegistered:
    try:
        return await facility_registration_service.register_facility(session, provider, payload, moment)
    except facility_registration_service.RegistrationCategoryError:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "category: choose one of the everyday categories"
        ) from None
    except facility_registration_service.SimilarListingError as error:
        raise HTTPException(
            status.HTTP_409_CONFLICT, {"message": error.message, "listing_id": error.listing_id}
        ) from None


@router.post(
    "/facilities/{main_id}/branches",
    response_model=BranchCreated,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(branch_rate_limit)],
    summary="Provider: add a branch to my facility (a draft for staff to verify)",
    responses={
        404: {"description": "No approved link on this facility."},
        409: {"description": "The phone number or the address is already in this facility."},
        422: {"description": "A rule for branches is broken (for example the facility is itself a branch)."},
    },
)
async def add_branch(
    main_id: int,
    payload: BranchCreate,
    provider: User = Depends(require_role(Role.provider)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> BranchCreated:
    try:
        return await branch_service.create_branch(session, provider, main_id, payload, moment)
    except branch_service.NoAccessToMainFacilityError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NO_LISTING) from None
    except branch_rules.BranchRuleError as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error)) from None
    except branch_service.BranchDuplicateError:
        raise HTTPException(status.HTTP_409_CONFLICT, branch_service.BRANCH_ALREADY_REGISTERED) from None


@router.get(
    "/facilities/{main_id}/branches",
    response_model=BranchList,
    summary="Provider: the branches of my facility, of every status",
    responses={404: {"description": "No approved link on this facility."}},
)
async def list_my_branches(
    main_id: int,
    provider: User = Depends(require_role(Role.provider)),
    session: AsyncSession = Depends(get_session),
) -> BranchList:
    try:
        return await branch_service.list_branches(session, provider, main_id)
    except branch_service.NoAccessToMainFacilityError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NO_LISTING) from None


@router.get(
    "/claimable",
    response_model=ClaimableList,
    dependencies=[Depends(claimable_search_rate_limit)],
    summary="Provider: find a published facility to ask to manage (name, area and category only)",
)
async def find_claimable(
    search_text: str = Query(
        alias="q",
        min_length=2,
        max_length=100,
        description="Part of the facility's name or its area. 'q' is the usual short name for a search text.",
    ),
    provider: User = Depends(require_role(Role.provider)),
    session: AsyncSession = Depends(get_session),
) -> ClaimableList:
    return await facility_registration_service.find_claimable(session, search_text)


@router.post(
    "/claims",
    response_model=ClaimCreated,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(claim_rate_limit)],
    summary="Provider: ask to manage a published facility (a pending owner link for staff to check)",
    responses={
        404: {"description": "The facility is not published."},
        409: {"description": "You already manage it, or your request is waiting."},
    },
)
async def claim_facility(
    payload: ClaimCreate,
    provider: User = Depends(require_role(Role.provider)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> ClaimCreated:
    try:
        return await facility_registration_service.claim_listing(session, provider, payload, moment)
    except facility_registration_service.ListingNotClaimableError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Facility not found") from None
    except facility_registration_service.AlreadyManagerError:
        raise HTTPException(status.HTTP_409_CONFLICT, facility_registration_service.ALREADY_MANAGER) from None
    except facility_registration_service.RequestWaitingError:
        raise HTTPException(status.HTTP_409_CONFLICT, facility_registration_service.REQUEST_WAITING) from None


@router.get(
    "/listings",
    response_model=OwnerList,
    summary="Provider: every facility link I have, with its state (waiting, approved or removed)",
)
async def list_my_links(
    provider: User = Depends(require_role(Role.provider)),
    session: AsyncSession = Depends(get_session),
) -> OwnerList:
    return await owner_link_service.my_links(session, provider)


@router.get(
    "/listings/{listing_id}",
    response_model=ProviderListing,
    summary="Provider: one of my listings (needs an approved link)",
    responses={404: {"description": "No approved link to this listing."}},
)
async def get_one_of_my_listings(
    listing_id: int,
    provider: User = Depends(require_role(Role.provider)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> ProviderListing:
    try:
        return await provider_service.get_own_detail(session, provider, moment, listing_id)
    except provider_service.NoLinkedListingError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NO_LISTING) from None


@router.patch(
    "/listings/{listing_id}",
    response_model=ProviderListing,
    summary="Provider: change description, services, opening hours or phones of one of my listings",
    responses={404: {"description": "No approved link to this listing."}},
)
async def update_one_of_my_listings(
    listing_id: int,
    payload: ProviderListingUpdate,
    provider: User = Depends(require_role(Role.provider)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> ProviderListing:
    try:
        return await provider_service.update_own_listing(session, provider, payload, moment, listing_id)
    except provider_service.NoLinkedListingError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NO_LISTING) from None


@router.get(
    "/listing",
    response_model=ProviderListing,
    summary="Provider: my own listing",
    responses={404: {"description": NO_LISTING}},
)
async def get_my_listing(
    provider: User = Depends(require_role(Role.provider)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> ProviderListing:
    try:
        return await provider_service.get_own_detail(session, provider, moment)
    except provider_service.NoLinkedListingError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NO_LISTING) from None


@router.patch(
    "/listing",
    response_model=ProviderListing,
    summary="Provider: change description, services, opening hours or phones",
    responses={404: {"description": NO_LISTING}},
)
async def update_my_listing(
    payload: ProviderListingUpdate,
    provider: User = Depends(require_role(Role.provider)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> ProviderListing:
    try:
        return await provider_service.update_own_listing(session, provider, payload, moment)
    except provider_service.NoLinkedListingError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NO_LISTING) from None

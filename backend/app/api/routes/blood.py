"""Find blood (blood banks) and donate blood (donation centres). US-15, US-16, FR-27, FR-28.
HTTP only: the rules are in services/blood_service.py. Contract: specs/backend/api-spec.md
("Phase 8 rules for both blood endpoints")."""

from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, Query
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.body_params import params_from_body
from app.api.dependencies import get_current_moment, get_session
from app.schemas.blood import BloodBankList, BloodBankParams, DonationCentreList, PagedLocationParams
from app.services import blood_service

router = APIRouter(prefix="/blood", tags=["Blood"])


@router.get(
    "/banks", response_model=BloodBankList, summary="Blood banks, nearest first, with their blood groups"
)
async def blood_banks(
    params: Annotated[BloodBankParams, Query()],
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> BloodBankList:
    return await blood_service.list_blood_banks(session, params, moment)


@router.get(
    "/donation-centres",
    response_model=DonationCentreList,
    summary="Where to donate blood, with the donation hours",
)
async def donation_centres(
    params: Annotated[PagedLocationParams, Query()],
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> DonationCentreList:
    return await blood_service.list_donation_centres(session, params, moment)


@router.post(
    "/banks",
    response_model=BloodBankList,
    summary="The same blood banks with the visitor's position in the body, never in the address (NFR-07)",
    responses={422: {"description": "A bad field. The answer never repeats the position that was sent."}},
)
async def blood_banks_with_position_in_body(
    body: Annotated[dict[str, Any], Body(description="The fields of GET /blood/banks; lat, lng go here.")],
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> BloodBankList:
    """A visitor's position is private: here it travels in the body, not in an address that a host may log."""
    return await blood_service.list_blood_banks(session, params_from_body(BloodBankParams, body), moment)


@router.post(
    "/donation-centres",
    response_model=DonationCentreList,
    summary="The same donation centres, the visitor's position in the body, never in the address (NFR-07)",
    responses={422: {"description": "A bad field. The answer never repeats the position that was sent."}},
)
async def donation_centres_with_position_in_body(
    body: Annotated[
        dict[str, Any], Body(description="The fields of GET /blood/donation-centres; `lat`, `lng` go here.")
    ],
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> DonationCentreList:
    params = params_from_body(PagedLocationParams, body)
    return await blood_service.list_donation_centres(session, params, moment)

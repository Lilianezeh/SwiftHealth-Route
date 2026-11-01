"""SwiftRescue: emergency contacts grouped by category, 112 first (FR-14 to FR-19, FR-26).
HTTP only: the rules are in services/emergency_service.py. Contract: specs/backend/api-spec.md."""
from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, Query
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.body_params import params_from_body
from app.api.dependencies import get_current_moment, get_session
from app.schemas.emergency import EmergencyResponse
from app.schemas.location import LocationParams
from app.services import emergency_service

router = APIRouter(prefix="/emergency", tags=["Emergency"])


@router.get("", response_model=EmergencyResponse)
async def get_emergency(
    location: Annotated[LocationParams, Query()],
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> EmergencyResponse:
    return await emergency_service.get_emergency(session, location, moment)


@router.post(
    "",
    response_model=EmergencyResponse,
    summary="The same emergency list with the visitor's position in the body, never in the address (NFR-07)",
    responses={422: {"description": "A bad field. The answer never repeats the position that was sent."}},
)
async def get_emergency_with_position_in_body(
    body: Annotated[dict[str, Any], Body(description="The fields of GET /emergency; `lat`, `lng` go here.")],
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> EmergencyResponse:
    """A visitor's position is private: here it travels in the body, not in an address that a host may log."""
    return await emergency_service.get_emergency(session, params_from_body(LocationParams, body), moment)

"""SwiftRescue: emergency contacts grouped by category, 112 first (FR-14 to FR-19, FR-26).
HTTP only: the rules are in services/emergency_service.py. Contract: specs/backend/api-spec.md."""
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlmodel.ext.asyncio.session import AsyncSession

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

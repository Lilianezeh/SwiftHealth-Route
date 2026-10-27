"""The SwiftRescue contacts for staff. HTTP only: the rules are in services/emergency_admin_service.py.
Contract: specs/backend/api-spec.md section 5, "SwiftRescue contacts for staff". Editors and admins
only; a verifier or a provider gets 403."""

from datetime import datetime

from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment, get_session, require_role
from app.models import User
from app.models.base import Role
from app.schemas.emergency_admin import EmergencyContactGroups
from app.services import emergency_admin_service

router = APIRouter(prefix="/staff/emergency-contacts", tags=["Staff"])


@router.get(
    "",
    response_model=EmergencyContactGroups,
    summary="Staff: the contacts of every SwiftRescue group, of every status",
)
async def list_emergency_contacts(
    staff: User = Depends(require_role(Role.editor)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> EmergencyContactGroups:
    return await emergency_admin_service.list_groups(session, staff, moment)

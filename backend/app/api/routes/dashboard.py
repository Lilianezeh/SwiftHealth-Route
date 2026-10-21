"""Counts for the staff dashboard (Recharts). HTTP only: the rules are in services/dashboard_service.py.
Contract: specs/backend/api-spec.md, section 10 (US-11, FR-34)."""

from datetime import datetime

from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment, get_session, require_role
from app.models import User
from app.models.base import Role
from app.schemas.dashboard import DashboardStats
from app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_stats(
    _user: User = Depends(require_role(Role.editor, Role.admin)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> DashboardStats:
    return await dashboard_service.get_stats(session, moment)

"""Public helpers: filter lists (/meta) and the "List your facility" form.

See specs/backend/api-spec.md section 3. HTTP only: the rules are in services/meta_service.py.
"""
from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_session
from app.schemas.meta import MetaResponse
from app.services import meta_service

router = APIRouter(tags=["Public"])


@router.get("/meta", response_model=MetaResponse)
async def meta(session: AsyncSession = Depends(get_session)) -> MetaResponse:
    return await meta_service.get_meta(session)


# TODO: POST /facility-submissions (roadmap phase 10d)

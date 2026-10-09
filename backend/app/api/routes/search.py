"""Public search: open now, nearest first (US-01, US-05, FR-04 to FR-08). HTTP only: the rules are in
services/search_service.py. Contract: specs/backend/api-spec.md, "GET /search"."""
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment, get_session
from app.schemas.search import SearchParams, SearchResponse
from app.services import search_service

router = APIRouter(prefix="/search", tags=["Search"])


@router.get("", response_model=SearchResponse)
async def search(
    params: Annotated[SearchParams, Query()],
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> SearchResponse:
    return await search_service.search_listings(session, params, moment)

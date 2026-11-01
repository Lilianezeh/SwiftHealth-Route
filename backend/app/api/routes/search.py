"""Public search: open now, nearest first (US-01, US-05, FR-04 to FR-08). HTTP only: the rules are in
services/search_service.py. Contract: specs/backend/api-spec.md, "GET /search"."""
from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, Query
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.body_params import params_from_body
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


@router.post(
    "",
    response_model=SearchResponse,
    summary="The same search with the visitor's position in the body, never in the address (NFR-07)",
    responses={422: {"description": "A bad field. The answer never repeats the position that was sent."}},
)
async def search_with_position_in_body(
    body: Annotated[dict[str, Any], Body(description="The fields of GET /search; `lat`, `lng` go here.")],
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> SearchResponse:
    """A visitor's position is private. In a GET it is in the query string, which a hosting platform
    may log before our code can redact it; here it travels in the body. It is used for this request
    only: not stored and not logged.

    The body is checked here, not by FastAPI, so that a 422 says which field is wrong and never
    repeats a value (FastAPI would put the whole input, the position included, in the answer)."""
    params = params_from_body(SearchParams, body)
    return await search_service.search_listings(session, params, moment)

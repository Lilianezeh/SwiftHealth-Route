"""Public helpers: filter lists (/meta) and the closed "List your facility" form.

See specs/backend/api-spec.md section 3. HTTP only: the rules are in services/meta_service.py. The old open
form answers 401 since accounts phase 7 (decision D14); facilities are registered through
`POST /provider/facilities` (api/routes/providers.py).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_session
from app.schemas.meta import MetaResponse
from app.services import meta_service

router = APIRouter(tags=["Public"])

SIGN_UP_FIRST = "Sign up or log in to list your facility."


@router.get("/meta", response_model=MetaResponse)
async def meta(session: AsyncSession = Depends(get_session)) -> MetaResponse:
    return await meta_service.get_meta(session)


@router.post(
    "/facility-submissions",
    summary="Closed: list your facility now needs an account (use POST /provider/facilities)",
    responses={401: {"description": SIGN_UP_FIRST}},
)
async def closed_facility_submissions() -> None:
    # The body is not read on purpose: nothing is stored and nothing is validated for a closed route.
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, SIGN_UP_FIRST)

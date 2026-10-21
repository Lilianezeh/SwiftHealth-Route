"""Public helpers: filter lists (/meta) and the "List your facility" form.

See specs/backend/api-spec.md section 3. HTTP only: the rules are in services/meta_service.py
and services/submission_service.py.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment, get_session, submission_rate_limit
from app.schemas.meta import MetaResponse
from app.schemas.submission import SubmissionCreate, SubmissionReceived
from app.services import meta_service, submission_service

router = APIRouter(tags=["Public"])


@router.get("/meta", response_model=MetaResponse)
async def meta(session: AsyncSession = Depends(get_session)) -> MetaResponse:
    return await meta_service.get_meta(session)


@router.post(
    "/facility-submissions",
    response_model=SubmissionReceived,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(submission_rate_limit)],
    summary="List your facility: sends a draft for the team to verify",
)
async def create_facility_submission(
    payload: SubmissionCreate,
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> SubmissionReceived:
    try:
        await submission_service.create_submission(session, payload, moment)
    except submission_service.SubmissionCategoryError:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "category: choose one of the everyday categories"
        ) from None
    return SubmissionReceived(message=submission_service.THANKS)

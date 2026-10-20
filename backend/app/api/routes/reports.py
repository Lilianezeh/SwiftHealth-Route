"""Reports: the public form (US-08, FR-20 to FR-22) and the staff queue (US-12, FR-35).
HTTP only: the rules are in services/report_service.py and services/report_queue_service.py.
Contract: specs/backend/api-spec.md, "POST /reports", "GET /reports" and "PATCH /reports/{report_id}"."""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment, get_session, report_rate_limit, require_role
from app.core.config import settings
from app.core.rate_limit import get_client_ip
from app.models import User
from app.models.base import Role
from app.schemas.report import ReportCreate, ReportCreated
from app.schemas.report_queue import ReportClose, ReportList, ReportQueueParams, ReportRead
from app.services import report_queue_service, report_service, staff_alert_service

router = APIRouter(prefix="/reports", tags=["Reports"])
EDITOR_ROLES = (Role.editor, Role.admin)


@router.post(
    "",
    response_model=ReportCreated,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(report_rate_limit)],
)
async def create_report(
    payload: ReportCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> ReportCreated:
    client_ip = get_client_ip(request, settings.trusted_proxy_count)
    try:
        outcome = await report_service.create_report(session, payload, client_ip, moment)
    except report_service.ReportListingNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found") from None
    if outcome.alert is not None:
        # After the answer is sent: a slow email or SMS must not make the visitor wait or fail the report.
        background_tasks.add_task(staff_alert_service.send_alerts, outcome.alert)
    return ReportCreated(id=outcome.report_id, message=report_service.THANK_YOU)


@router.get("", response_model=ReportList)
async def list_reports(
    params: Annotated[ReportQueueParams, Query()],
    _user: User = Depends(require_role(*EDITOR_ROLES)),
    session: AsyncSession = Depends(get_session),
) -> ReportList:
    return await report_queue_service.list_reports(session, params)


@router.patch("/{report_id}", response_model=ReportRead)
async def close_report(
    report_id: int,
    payload: ReportClose,
    user: User = Depends(require_role(*EDITOR_ROLES)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> ReportRead:
    try:
        return await report_queue_service.close_report(session, user, report_id, payload.status, moment)
    except report_queue_service.ReportNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report not found") from None
    except report_queue_service.ReportAlreadyClosedError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, report_queue_service.CLOSED_MESSAGE) from None

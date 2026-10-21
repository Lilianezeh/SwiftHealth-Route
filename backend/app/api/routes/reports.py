"""Public report form (US-08, FR-20 to FR-22). HTTP only: the rules are in services/report_service.py.
Contract: specs/backend/api-spec.md, "POST /reports". The staff queue (GET and PATCH) is phase 11."""

from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment, get_session, report_rate_limit
from app.core.config import settings
from app.core.rate_limit import get_client_ip
from app.schemas.report import ReportCreate, ReportCreated
from app.services import report_service, staff_alert_service

router = APIRouter(prefix="/reports", tags=["Reports"])


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

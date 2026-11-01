"""Cloudinary signed uploads for the entrance photo: staff's folder and the owner's own folder. HTTP only.
See specs/backend/api-spec.md, section 9, and "Phase 10 clarifications" (FR-32, US-10, NFR-06, C8), and
specs/2026-11-01-owner-form-location-photo/ (decision L3: owner photos go to an owner-only folder)."""

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.dependencies import get_current_moment, owner_upload_rate_limit, require_role
from app.core.config import settings
from app.integrations.cloudinary import CloudinaryNotConfiguredError, parse_cloudinary_url, sign_parameters
from app.models import User
from app.models.base import Role

router = APIRouter(prefix="/uploads", tags=["Uploads"])

FOLDER_PREFIX = "swifthealth"
OWNER_FOLDER = "owner-entrances"


class SignRequest(BaseModel):
    folder: Literal["entrances"]


class SignResponse(BaseModel):
    cloud_name: str
    api_key: str
    timestamp: int
    signature: str
    folder: str
    upload_preset: str | None = None


def _sign(folder_name: str, moment: datetime) -> SignResponse:
    """Plain computation, nothing awaited: the routes are `async def` like the others (on the event loop)."""
    try:
        account = parse_cloudinary_url(settings.cloudinary_url)
    except CloudinaryNotConfiguredError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Photo upload is not set up.") from None
    timestamp = int(moment.timestamp())
    folder = f"{FOLDER_PREFIX}/{folder_name}"
    signed = {"folder": folder, "timestamp": str(timestamp)}
    preset = settings.cloudinary_upload_preset or None
    if preset:
        signed["upload_preset"] = preset
    return SignResponse(
        cloud_name=account.cloud_name,
        api_key=account.api_key,
        timestamp=timestamp,
        signature=sign_parameters(signed, account.api_secret),
        folder=folder,
        upload_preset=preset,
    )


@router.post("/sign", response_model=SignResponse, summary="Staff: parameters for a direct photo upload")
async def sign_upload(
    payload: SignRequest,
    _user: User = Depends(require_role(Role.verifier, Role.editor, Role.admin)),
    moment: datetime = Depends(get_current_moment),
) -> SignResponse:
    return _sign(payload.folder, moment)


@router.post(
    "/owner-sign",
    response_model=SignResponse,
    dependencies=[Depends(owner_upload_rate_limit)],
    summary="Facility owner: parameters for a direct upload of the entrance photo to the owner folder",
)
async def sign_owner_upload(
    _user: User = Depends(require_role(Role.provider)),
    moment: datetime = Depends(get_current_moment),
) -> SignResponse:
    return _sign(OWNER_FOLDER, moment)

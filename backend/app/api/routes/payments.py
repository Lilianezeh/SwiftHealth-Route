"""Paystack (test mode only): start a featured payment, and the signed webhook. HTTP only: the rules are in
services/payment_service.py and the Paystack calls in integrations/paystack.py.
Contract: specs/backend/api-spec.md, section 8 (FR-44, FR-46)."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment, get_session, require_role
from app.integrations import paystack
from app.models import User
from app.models.base import Role
from app.schemas.payment import FeaturedRequest, FeaturedStarted
from app.services import payment_service, provider_service

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.post(
    "/featured",
    response_model=FeaturedStarted,
    summary="Provider: start a 30-day featured payment (Paystack test mode)",
    responses={
        400: {"description": "The listing is not published."},
        404: {"description": "No listing is linked to the account."},
        502: {"description": "Paystack did not accept the payment."},
        503: {"description": "Payments are not set up, or the key is a live key."},
    },
)
async def start_featured_payment(
    _payload: FeaturedRequest,
    provider: User = Depends(require_role(Role.provider)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> FeaturedStarted:
    try:
        return await payment_service.start_featured_payment(session, provider, moment)
    except provider_service.NoLinkedListingError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No listing is linked to your account.") from None
    except payment_service.ListingNotPublishedError:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Only a published listing can be featured."
        ) from None
    except paystack.PaymentsNotSetUpError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Payments are not set up yet.") from None
    except paystack.LiveKeyRefusedError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Live payments are switched off.") from None
    except paystack.PaymentStartError:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Could not start the payment. Try again.") from None

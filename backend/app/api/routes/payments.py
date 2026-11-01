"""Paystack (test mode only): start a featured payment, and the signed webhook. HTTP only: the rules are in
services/payment_service.py and the Paystack calls in integrations/paystack.py.
Contract: specs/backend/api-spec.md, section 8 (FR-44, FR-46)."""

import json
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_moment, get_session, require_role
from app.integrations import paystack
from app.models import User
from app.models.base import Role
from app.schemas.payment import (
    FeaturedRequest,
    FeaturedStarted,
    OwnerFeeRequest,
    OwnerFeeStarted,
    OwnerFeeVerified,
    PaymentVerified,
    WebhookReceived,
)
from app.services import owner_fee_service, payment_service, provider_service

logger = logging.getLogger(__name__)

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
    except provider_service.NotAnOwnerError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only an owner can pay.") from None
    except payment_service.ListingNotPublishedError:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Only a published listing can be featured."
        ) from None
    except payment_service.ListingNotVerifiedError:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Only a verified listing can be featured."
        ) from None
    except paystack.PaymentsNotSetUpError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Payments are not set up yet.") from None
    except paystack.LiveKeyRefusedError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Live payments are switched off.") from None
    except paystack.PaymentStartError:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Could not start the payment. Try again.") from None


@router.get(
    "/verify/{reference}",
    response_model=PaymentVerified,
    summary="Provider: has the webhook for this payment been applied?",
    responses={
        404: {"description": "No listing is linked, or the reference is not of the caller's listing."}
    },
)
async def verify_payment(
    reference: str,
    provider: User = Depends(require_role(Role.provider)),
    session: AsyncSession = Depends(get_session),
) -> PaymentVerified:
    try:
        return await payment_service.verify_payment(session, provider, reference)
    except (
        provider_service.NoLinkedListingError,
        provider_service.NotAnOwnerError,
        payment_service.ReferenceNotFoundError,
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payment not found") from None


@router.post(
    "/webhook",
    response_model=WebhookReceived,
    summary="Paystack only: a signed event (charge.success features the listing)",
    responses={
        400: {"description": "The body is not a JSON object."},
        401: {"description": "Bad signature."},
    },
)
async def paystack_webhook(
    request: Request,
    signature: str | None = Header(default=None, alias="x-paystack-signature"),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> WebhookReceived:
    # The signature is made over the raw bytes, so the body is read before anything parses it.
    raw_body = await request.body()
    if not paystack.signature_is_valid(raw_body, signature):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid signature")
    try:
        payload = json.loads(raw_body)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The body is not JSON") from None
    if not isinstance(payload, dict):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The body is not a JSON object")

    # Two kinds of payment, told apart by the shape of our own reference: Featured (SH-...) and the
    # owner fee (SO-...).
    fee_event = owner_fee_service.parse_charge_success(payload)
    if fee_event is not None:
        if not await owner_fee_service.apply_charge_success(session, fee_event, moment):
            logger.info(
                "Paystack webhook not applied (done before, or no such link), reference %s",
                fee_event.reference,
            )
        return WebhookReceived(status="ok")
    event = payment_service.parse_charge_success(payload)
    if event is None:
        # Only the reference is logged: never the body, the email or anything of the card.
        logger.info("Paystack webhook ignored, reference %s", payment_service.reference_of(payload))
    elif not await payment_service.apply_charge_success(session, event, moment):
        logger.info(
            "Paystack webhook not applied (done before, or no such listing), reference %s", event.reference
        )
    return WebhookReceived(status="ok")


@router.post(
    "/owner-fee",
    response_model=OwnerFeeStarted,
    summary="Provider: start the monthly owner fee for one of your links (Paystack test mode)",
    responses={
        404: {"description": "No such link of the caller."},
        409: {"description": "The link is waiting for staff or removed: there is nothing to pay."},
        502: {"description": "Paystack did not accept the payment."},
        503: {"description": "Payments are not set up, or the key is a live key."},
    },
)
async def start_owner_fee_payment(
    payload: OwnerFeeRequest,
    provider: User = Depends(require_role(Role.provider)),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> OwnerFeeStarted:
    try:
        return await owner_fee_service.start_payment(session, provider, payload.link_id, moment)
    except owner_fee_service.LinkNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Link not found") from None
    except owner_fee_service.LinkNotPayableError:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "There is nothing to pay for this request now."
        ) from None
    except paystack.PaymentsNotSetUpError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Payments are not set up yet.") from None
    except paystack.LiveKeyRefusedError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Live payments are switched off.") from None
    except paystack.PaymentStartError:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Could not start the payment. Try again.") from None


@router.get(
    "/owner-fee/{reference}",
    response_model=OwnerFeeVerified,
    summary="Provider: has the webhook for this owner-fee payment been applied?",
    responses={404: {"description": "The reference is not of one of the caller's links."}},
)
async def verify_owner_fee_payment(
    reference: str,
    provider: User = Depends(require_role(Role.provider)),
    session: AsyncSession = Depends(get_session),
) -> OwnerFeeVerified:
    try:
        return await owner_fee_service.verify_payment(session, provider, reference)
    except owner_fee_service.LinkNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payment not found") from None

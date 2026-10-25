"""Sign-up (FR-48, FR-49). HTTP only: the rules are in services/signup_service.py.
Contract: specs/backend/api-spec.md, section 4c. Every route is public (a person who signs up has no
account to log in to yet) and closed with 503 unless sign-up is open; the answer for an email that is
already an account is the same as for a new one."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import (
    get_current_moment,
    get_session,
    login_rate_limit,
    signup_rate_limit,
    verify_code_rate_limit,
)
from app.api.limit_errors import code_too_soon, too_many_codes, too_many_wrong_codes
from app.core.passwords import PasswordRuleError
from app.schemas.signup import ConfirmRequest, ConfirmStep, ResendRequest, SignupDone, SignupRequest
from app.services import auth_service, signup_service

router = APIRouter(prefix="/auth", tags=["Auth"])

CLOSED = "Sign-up is not open yet."
INVALID_CODE = "Invalid or expired code"


def _problem(error: Exception) -> HTTPException:
    """Turns the service's domain errors into the answers of sign-up."""
    if isinstance(error, signup_service.SignupClosedError):
        return HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, CLOSED)
    if isinstance(error, signup_service.TooManySignupsError):
        return HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS, "Too many sign-up attempts for this email. Try again later."
        )
    if isinstance(error, PasswordRuleError):
        return HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error))
    if isinstance(error, signup_service.SignupEmailNotSentError):
        return HTTPException(status.HTTP_502_BAD_GATEWAY, "Could not send the email. Try again.")
    if isinstance(error, auth_service.CodeNotSentError):
        return HTTPException(status.HTTP_502_BAD_GATEWAY, "Could not send the code. Try again.")
    if isinstance(error, signup_service.InvalidSignupCodeError):
        return HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_CODE)
    if isinstance(error, signup_service.SignupLockedError):
        return too_many_wrong_codes(error.seconds_left)
    if isinstance(error, auth_service.CodeTooSoonError):
        return code_too_soon(error.seconds_left)
    if isinstance(error, auth_service.TooManyCodesError):
        return too_many_codes(error.seconds_left)
    raise error


EXPECTED = (
    signup_service.SignupClosedError,
    signup_service.TooManySignupsError,
    PasswordRuleError,
    signup_service.SignupEmailNotSentError,
    auth_service.CodeNotSentError,
    signup_service.InvalidSignupCodeError,
    signup_service.SignupLockedError,
    auth_service.CodeTooSoonError,
    auth_service.TooManyCodesError,
)


@router.post(
    "/signup",
    response_model=ConfirmStep,
    dependencies=[Depends(signup_rate_limit)],
    summary="Sign up as staff or as a facility owner (provider): makes the account and emails a code",
    responses={503: {"description": "Sign-up is not open yet."}, 429: {"description": "Too many attempts."}},
)
async def sign_up(
    request: SignupRequest,
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> ConfirmStep:
    try:
        step = await signup_service.start_signup(session, request, moment)
    except EXPECTED as error:
        raise _problem(error) from None
    return ConfirmStep(confirm_token=step.confirm_token, sent_to=step.sent_to)


@router.post(
    "/confirm-email",
    response_model=ConfirmStep,
    dependencies=[Depends(verify_code_rate_limit)],
    summary="The code of the email: confirms the email and texts a code to the phone",
)
async def confirm_email(
    request: ConfirmRequest,
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> ConfirmStep:
    try:
        step = await signup_service.confirm_email(session, request.confirm_token, request.code, moment)
    except EXPECTED as error:
        raise _problem(error) from None
    return ConfirmStep(confirm_token=step.confirm_token, sent_to=step.sent_to)


@router.post(
    "/confirm-phone",
    response_model=SignupDone,
    dependencies=[Depends(verify_code_rate_limit)],
    summary="The code of the phone: the account is confirmed (a provider can log in; staff wait)",
)
async def confirm_phone(
    request: ConfirmRequest,
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> SignupDone:
    try:
        outcome = await signup_service.confirm_phone(session, request.confirm_token, request.code, moment)
    except EXPECTED as error:
        raise _problem(error) from None
    return SignupDone(status=outcome)


@router.post(
    "/signup-resend-code",
    response_model=ConfirmStep,
    dependencies=[Depends(login_rate_limit)],
    summary="A new email or phone code for the step the token belongs to (60 seconds apart, 5 an hour)",
    responses={429: {"description": "Under 60 s since the last code, or 5 codes in an hour (Retry-After)."}},
)
async def resend_sign_up_code(
    request: ResendRequest,
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> ConfirmStep:
    try:
        step = await signup_service.resend_code(session, request.confirm_token, moment)
    except EXPECTED as error:
        raise _problem(error) from None
    return ConfirmStep(confirm_token=step.confirm_token, sent_to=step.sent_to)

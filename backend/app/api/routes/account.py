"""Account self-service and the forgotten password. HTTP only: the rules are in services/account_service.py.
Contract: specs/backend/api-spec.md section 4d (FR-54, US-21). The routes under /account need a login
and act on the caller's own account only (the id is never in the request). The two /auth routes are
public and give the same answer for every email."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import forgot_rate_limit, get_current_moment, get_current_user, get_session
from app.api.limit_errors import too_many_codes, too_many_wrong_codes
from app.core.passwords import PasswordRuleError
from app.models import User
from app.schemas.account import (
    AccountRead,
    Closed,
    CloseRequest,
    CodeConfirm,
    ContactStep,
    EmailStart,
    ForgotRequest,
    ForgotStep,
    NameChange,
    PasswordChange,
    PasswordChanged,
    PhoneStart,
    Reset,
    ResetRequest,
)
from app.services import account_service as service
from app.services import auth_service

router = APIRouter(tags=["Account"])

INVALID_CODE = "Invalid or expired code"
WRONG_PASSWORD = "The password is not right."


def _problem(error: Exception, wrong_code_status: int = status.HTTP_400_BAD_REQUEST) -> HTTPException:
    """Turns the service's domain errors into the answers of this feature. A wrong code is 400 for a logged-in
    person (a 401 means "log in again" and the screens would log them out) and 401 for the public reset."""
    if isinstance(error, service.EmailTakenError):
        return HTTPException(status.HTTP_409_CONFLICT, "That email is already used.")
    if isinstance(error, service.NothingToChangeError):
        return HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"That is already your {error.what}.")
    if isinstance(error, service.InvalidAccountCodeError):
        return HTTPException(wrong_code_status, INVALID_CODE)
    if isinstance(error, service.AccountCodeLockedError):
        return too_many_wrong_codes(error.seconds_left)
    if isinstance(error, auth_service.TooManyCodesError):
        return too_many_codes(error.seconds_left)
    if isinstance(error, service.WrongPasswordError):
        return HTTPException(status.HTTP_403_FORBIDDEN, WRONG_PASSWORD)  # not 401: that means "log in again"
    if isinstance(error, service.PasswordLockedError):
        return too_many_wrong_codes(error.seconds_left)
    if isinstance(error, service.TooManyResetsError):
        return too_many_codes(error.seconds_left)
    if isinstance(error, PasswordRuleError):
        return HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error))
    if isinstance(error, service.EmailNotSetUpError):
        return HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Email is not set up yet.")
    if isinstance(error, service.EmailNotSentError):
        return HTTPException(status.HTTP_502_BAD_GATEWAY, "Could not send the email. Try again.")
    if isinstance(error, auth_service.CodeNotSentError):
        return HTTPException(status.HTTP_502_BAD_GATEWAY, "Could not send the code. Try again.")
    if isinstance(error, service.LastAdminError):
        return HTTPException(status.HTTP_409_CONFLICT, "This is the last active admin.")
    raise error


EXPECTED = (
    service.EmailTakenError,
    service.NothingToChangeError,
    service.InvalidAccountCodeError,
    service.AccountCodeLockedError,
    auth_service.TooManyCodesError,
    service.WrongPasswordError,
    service.PasswordLockedError,
    service.TooManyResetsError,
    PasswordRuleError,
    service.EmailNotSetUpError,
    service.EmailNotSentError,
    auth_service.CodeNotSentError,
    service.LastAdminError,
)


@router.get("/account", response_model=AccountRead, summary="Your own details")
async def get_account(user: User = Depends(get_current_user)) -> AccountRead:
    return service.profile(user)


@router.patch("/account", response_model=AccountRead, summary="Change your name")
async def change_name(
    request: NameChange,
    user: User = Depends(get_current_user),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> AccountRead:
    return service.profile(await service.change_name(session, user, request.name, moment))


@router.post(
    "/account/email/start",
    response_model=ContactStep,
    summary="A new email: a code goes to the NEW address (the old one works until it is confirmed)",
    responses={409: {"description": "Another account has that email."}},
)
async def start_email_change(
    request: EmailStart,
    user: User = Depends(get_current_user),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> ContactStep:
    try:
        step = await service.start_email_change(session, user, request.email, moment)
    except EXPECTED as error:
        raise _problem(error) from None
    return ContactStep(confirm_token=step.confirm_token, sent_to=step.sent_to)


@router.post("/account/email/confirm", response_model=AccountRead, summary="The code of the new email")
async def confirm_email_change(
    request: CodeConfirm,
    user: User = Depends(get_current_user),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> AccountRead:
    try:
        changed = await service.confirm_email_change(
            session, user, request.confirm_token, request.code, moment
        )
    except EXPECTED as error:
        raise _problem(error) from None
    return service.profile(changed)


@router.post(
    "/account/phone/start",
    response_model=ContactStep,
    summary="A new phone: a code is texted to it with Termii live; without Termii it is stored, unconfirmed",
)
async def start_phone_change(
    request: PhoneStart,
    user: User = Depends(get_current_user),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> ContactStep:
    try:
        step = await service.start_phone_change(session, user, request.phone, moment)
    except EXPECTED as error:
        raise _problem(error) from None
    return ContactStep(confirm_token=step.confirm_token, sent_to=step.sent_to)


@router.post("/account/phone/confirm", response_model=AccountRead, summary="The code of the new phone")
async def confirm_phone_change(
    request: CodeConfirm,
    user: User = Depends(get_current_user),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> AccountRead:
    try:
        changed = await service.confirm_phone_change(
            session, user, request.confirm_token, request.code, moment
        )
    except EXPECTED as error:
        raise _problem(error) from None
    return service.profile(changed)


@router.post(
    "/account/password",
    response_model=PasswordChanged,
    summary="A new password; every older login stops working and a new token is returned",
    responses={403: {"description": "The current password is not right."}},
)
async def change_password(
    request: PasswordChange,
    user: User = Depends(get_current_user),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> PasswordChanged:
    try:
        token = await service.change_password(
            session, user, request.current_password, request.new_password, moment
        )
    except EXPECTED as error:
        raise _problem(error) from None
    return PasswordChanged(access_token=token, expires_in=service.access_token_lifetime_seconds(user))


@router.post(
    "/account/close",
    response_model=Closed,
    summary="Close your account: personal data removed, the row and the audit entries stay",
    responses={409: {"description": "This is the last active admin."}},
)
async def close_account(
    request: CloseRequest,
    user: User = Depends(get_current_user),
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> Closed:
    try:
        await service.close_account(session, user, request.password, moment)
    except EXPECTED as error:
        raise _problem(error) from None
    return Closed()


@router.post(
    "/auth/forgot-password",
    response_model=ForgotStep,
    dependencies=[Depends(forgot_rate_limit)],
    summary="Forgot your password: a code is emailed; the answer is the same for every email",
)
async def forgot_password(
    request: ForgotRequest,
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> ForgotStep:
    try:
        token, sent_to = await service.forgot_password(session, request.email, moment)
    except EXPECTED as error:
        raise _problem(error) from None
    return ForgotStep(reset_token=token, sent_to=sent_to)


@router.post(
    "/auth/reset-password",
    response_model=Reset,
    summary="Set a new password with the emailed code (this does not log you in)",
)
async def reset_password(
    request: ResetRequest,
    moment: datetime = Depends(get_current_moment),
    session: AsyncSession = Depends(get_session),
) -> Reset:
    try:
        await service.reset_password(session, request.reset_token, request.code, request.new_password, moment)
    except EXPECTED as error:
        raise _problem(error, status.HTTP_401_UNAUTHORIZED) from None
    return Reset()

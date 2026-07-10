from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.deps import (
    clear_refresh_cookie,
    get_client_ip,
    get_current_session_id,
    get_current_user,
    handle_auth_error,
    require_fund_eligible_user,
    set_refresh_cookie,
)
from app.api.v1.auth.schemas import (
    AuthResponse,
    ChangeEmailConfirmRequest,
    ChangeEmailStartRequest,
    ChangePasswordRequest,
    CheckEmailRequest,
    CheckEmailResponse,
    ForgotPasswordRequest,
    FundEligibilityResponse,
    GoogleLoginRequest,
    LoginRequest,
    MfaEnrollConfirmRequest,
    MfaEnrollConfirmResponse,
    MfaEnrollStartResponse,
    MfaRequiredResponse,
    MfaVerifyRequest,
    OAuthLinkConfirmRequest,
    OAuthLinkRequiredResponse,
    OkResponse,
    ResetPasswordRequest,
    RevokeSessionRequest,
    RevokeSessionsResponse,
    SessionItemResponse,
    SessionListResponse,
    SignupCompleteRequest,
    SignupSendMobileRequest,
    SignupSetPasswordRequest,
    SignupStartRequest,
    SignupStartResponse,
    SignupVerifyEmailRequest,
    SignupVerifyMobileRequest,
    StepUpRequest,
    UserResponse,
    VerifiedResponse,
)
from app.application.auth.account_service import (
    cancel_account_deletion,
    change_email_confirm,
    change_email_start,
    change_password,
    confirm_oauth_link,
    fund_eligibility_status,
    mfa_enroll_confirm,
    mfa_enroll_start,
    request_account_deletion,
    verify_mfa_login,
)
from app.application.auth.session_service import (
    list_user_sessions,
    revoke_all_sessions,
    revoke_user_session,
)
from app.application.auth.service import (
    AuthError,
    check_email,
    forgot_password,
    login_with_email,
    login_with_google,
    logout,
    refresh_session,
    reset_password,
    signup_complete,
    signup_send_mobile_otp,
    signup_set_password,
    signup_start,
    signup_verify_email,
    signup_verify_mobile,
    get_user_by_id,
    user_to_public_dict,
)
from app.core.config import get_settings
from app.core.database import get_db
from app.infrastructure.persistence.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_response(user: User) -> UserResponse:
    data = user_to_public_dict(user)
    return UserResponse(**data)


def _auth_response(result: dict[str, Any]) -> AuthResponse:
    return AuthResponse(
        access_token=result["access_token"],
        user=_user_response(result["user"]),
        new_device=result.get("new_device", False),
    )


def _handle_login_result(result: dict[str, Any], response: Response) -> AuthResponse | MfaRequiredResponse | OAuthLinkRequiredResponse:
    if result["next"] == "mfa_required":
        return MfaRequiredResponse(
            mfa_token=result["mfa_token"],
            expires_in=result["expires_in"],
        )
    if result["next"] == "oauth_link_confirmation_required":
        return OAuthLinkRequiredResponse(
            link_token=result["link_token"],
            expires_in=result["expires_in"],
            email_hint=result["email_hint"],
        )
    set_refresh_cookie(response, result["refresh_token"])
    return _auth_response(result)


@router.post("/check-email", response_model=CheckEmailResponse)
async def post_check_email(
    body: CheckEmailRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CheckEmailResponse:
    result = await check_email(db, body.email)
    return CheckEmailResponse(**result)


@router.post("/signup/start", response_model=SignupStartResponse)
async def post_signup_start(
    body: SignupStartRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SignupStartResponse:
    try:
        result = await signup_start(
            db,
            email=body.email,
            turnstile_token=body.turnstile_token,
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return SignupStartResponse(**result)


@router.post("/signup/verify-email", response_model=VerifiedResponse)
async def post_signup_verify_email(body: SignupVerifyEmailRequest) -> VerifiedResponse:
    try:
        await signup_verify_email(body.signup_token, body.otp)
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return VerifiedResponse()


@router.post("/signup/set-password", response_model=OkResponse)
async def post_signup_set_password(body: SignupSetPasswordRequest) -> OkResponse:
    try:
        await signup_set_password(body.signup_token, body.password)
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return OkResponse()


@router.post("/signup/send-mobile-otp", response_model=OkResponse)
async def post_signup_send_mobile(body: SignupSendMobileRequest) -> OkResponse:
    try:
        await signup_send_mobile_otp(body.signup_token, body.mobile, body.country_code)
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return OkResponse()


@router.post("/signup/verify-mobile", response_model=VerifiedResponse)
async def post_signup_verify_mobile(body: SignupVerifyMobileRequest) -> VerifiedResponse:
    try:
        await signup_verify_mobile(body.signup_token, body.otp)
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return VerifiedResponse()


@router.post("/signup/complete", response_model=AuthResponse)
async def post_signup_complete(
    body: SignupCompleteRequest,
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AuthResponse:
    try:
        user, access_token, refresh_token = await signup_complete(
            db,
            signup_token=body.signup_token,
            first_name=body.first_name,
            last_name=body.last_name,
            middle_name=body.middle_name,
            device_fingerprint=body.device_fingerprint,
            user_agent=request.headers.get("user-agent"),
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    set_refresh_cookie(response, refresh_token)
    return AuthResponse(access_token=access_token, user=_user_response(user))


@router.post("/login")
async def post_login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        result = await login_with_email(
            db,
            email=body.email,
            password=body.password,
            turnstile_token=body.turnstile_token,
            device_fingerprint=body.device_fingerprint,
            user_agent=request.headers.get("user-agent"),
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return _handle_login_result(result, response)


@router.post("/google")
async def post_google_login(
    body: GoogleLoginRequest,
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        result = await login_with_google(
            db,
            id_token=body.id_token,
            device_fingerprint=body.device_fingerprint,
            user_agent=request.headers.get("user-agent"),
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return _handle_login_result(result, response)


@router.post("/mfa/verify")
async def post_mfa_verify(
    body: MfaVerifyRequest,
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        result = await verify_mfa_login(
            db,
            mfa_token=body.mfa_token,
            totp_code=body.totp_code,
            backup_code=body.backup_code,
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    set_refresh_cookie(response, result["refresh_token"])
    return _auth_response(result)


@router.post("/oauth/link/confirm")
async def post_oauth_link_confirm(
    body: OAuthLinkConfirmRequest,
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        result = await confirm_oauth_link(
            db,
            link_token=body.link_token,
            email_otp=body.email_otp,
            password=body.password,
            device_fingerprint=body.device_fingerprint,
            user_agent=request.headers.get("user-agent"),
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return _handle_login_result(result, response)


@router.post("/mfa/enroll/start", response_model=MfaEnrollStartResponse)
async def post_mfa_enroll_start(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MfaEnrollStartResponse:
    try:
        result = await mfa_enroll_start(db, current_user)
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return MfaEnrollStartResponse(**result)


@router.post("/mfa/enroll/confirm", response_model=MfaEnrollConfirmResponse)
async def post_mfa_enroll_confirm(
    body: MfaEnrollConfirmRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MfaEnrollConfirmResponse:
    try:
        result = await mfa_enroll_confirm(
            db,
            user=current_user,
            enroll_token=body.enroll_token,
            totp_code=body.totp_code,
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return MfaEnrollConfirmResponse(**result)


@router.get("/fund-eligibility/check", response_model=FundEligibilityResponse)
async def get_fund_eligibility(
    current_user: Annotated[User, Depends(get_current_user)],
) -> FundEligibilityResponse:
    result = fund_eligibility_status(current_user)
    return FundEligibilityResponse(**result)


@router.get("/fund-eligibility/gated-check", response_model=FundEligibilityResponse)
async def get_gated_fund_eligibility(
    current_user: Annotated[User, Depends(require_fund_eligible_user)],
) -> FundEligibilityResponse:
    result = fund_eligibility_status(current_user)
    return FundEligibilityResponse(**result)


@router.get("/sessions", response_model=SessionListResponse)
async def get_sessions(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    session_id: Annotated[UUID, Depends(get_current_session_id)],
) -> SessionListResponse:
    items = await list_user_sessions(
        db,
        user_id=current_user.id,
        current_session_id=session_id,
    )
    return SessionListResponse(sessions=[SessionItemResponse(**item) for item in items])


@router.post("/sessions/revoke", response_model=OkResponse)
async def post_revoke_session(
    body: RevokeSessionRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    session_id: Annotated[UUID, Depends(get_current_session_id)],
) -> OkResponse:
    if body.session_id == session_id:
        raise HTTPException(
            status_code=400,
            detail={"code": "cannot_revoke_current", "message": "Use sign out for this device."},
        )
    revoked = await revoke_user_session(
        db,
        user_id=current_user.id,
        session_id=body.session_id,
        ip=get_client_ip(request),
    )
    if not revoked:
        raise HTTPException(
            status_code=404,
            detail={"code": "session_not_found", "message": "Session not found."},
        )
    return OkResponse()


@router.post("/sessions/revoke-all", response_model=RevokeSessionsResponse)
async def post_revoke_all_sessions(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    session_id: Annotated[UUID, Depends(get_current_session_id)],
) -> RevokeSessionsResponse:
    revoked = await revoke_all_sessions(
        db,
        user_id=current_user.id,
        ip=get_client_ip(request),
        except_session_id=session_id,
        reason="user_revoke_all",
    )
    return RevokeSessionsResponse(revoked=revoked)


@router.post("/account/change-password", response_model=OkResponse)
async def post_change_password(
    body: ChangePasswordRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    session_id: Annotated[UUID, Depends(get_current_session_id)],
) -> OkResponse:
    try:
        await change_password(
            db,
            user=current_user,
            session_id=session_id,
            current_password=body.current_password,
            new_password=body.new_password,
            totp_code=body.totp_code,
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return OkResponse()


@router.post("/account/change-email/start")
async def post_change_email_start(
    body: ChangeEmailStartRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    session_id: Annotated[UUID, Depends(get_current_session_id)],
) -> dict[str, str]:
    try:
        return await change_email_start(
            db,
            user=current_user,
            session_id=session_id,
            new_email=body.new_email,
            current_password=body.current_password,
            totp_code=body.totp_code,
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc


@router.post("/account/change-email/confirm", response_model=OkResponse)
async def post_change_email_confirm(
    body: ChangeEmailConfirmRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    session_id: Annotated[UUID, Depends(get_current_session_id)],
) -> OkResponse:
    try:
        await change_email_confirm(
            db,
            user=current_user,
            session_id=session_id,
            change_token=body.change_token,
            otp=body.otp,
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return OkResponse()


@router.post("/account/delete-request")
async def post_delete_request(
    body: StepUpRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    session_id: Annotated[UUID, Depends(get_current_session_id)],
):
    try:
        return await request_account_deletion(
            db,
            user=current_user,
            session_id=session_id,
            current_password=body.current_password,
            totp_code=body.totp_code,
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc


@router.post("/account/delete-cancel", response_model=OkResponse)
async def post_delete_cancel(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> OkResponse:
    try:
        await cancel_account_deletion(db, user=current_user, ip=get_client_ip(request))
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return OkResponse()


@router.post("/refresh", response_model=AuthResponse)
async def post_refresh(
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AuthResponse:
    settings = get_settings()
    refresh_token = request.cookies.get(settings.refresh_cookie_name)
    if not refresh_token:
        raise HTTPException(
            status_code=401,
            detail={"code": "session_expired", "message": "Session expired"},
        )
    try:
        access_token, new_refresh_token = await refresh_session(
            db,
            refresh_token=refresh_token,
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        clear_refresh_cookie(response)
        raise handle_auth_error(exc) from exc

    from app.infrastructure.security.tokens import decode_access_token

    payload = decode_access_token(access_token)
    user_id = UUID(payload["sub"])
    user = await get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=401, detail={"code": "unauthorized", "message": "User not found"})
    set_refresh_cookie(response, new_refresh_token)
    return AuthResponse(access_token=access_token, user=_user_response(user))


@router.post("/logout", response_model=OkResponse)
async def post_logout(
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OkResponse:
    settings = get_settings()
    refresh_token = request.cookies.get(settings.refresh_cookie_name)
    if refresh_token:
        await logout(db, refresh_token=refresh_token, ip=get_client_ip(request))
    clear_refresh_cookie(response)
    return OkResponse()


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: Annotated[User, Depends(get_current_user)]) -> UserResponse:
    return _user_response(current_user)


@router.post("/forgot-password", response_model=OkResponse)
async def post_forgot_password(
    body: ForgotPasswordRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OkResponse:
    try:
        await forgot_password(
            db,
            email=body.email,
            turnstile_token=body.turnstile_token,
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return OkResponse()


@router.post("/reset-password", response_model=OkResponse)
async def post_reset_password(
    body: ResetPasswordRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OkResponse:
    try:
        await reset_password(
            db,
            token=body.token,
            new_password=body.new_password,
            ip=get_client_ip(request),
        )
    except AuthError as exc:
        raise handle_auth_error(exc) from exc
    return OkResponse()

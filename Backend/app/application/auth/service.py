from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.infrastructure.otp.service import (
    create_reset_token,
    create_signup_draft,
    delete_signup_draft,
    generate_otp,
    get_signup_draft,
    update_signup_draft,
    verify_otp,
    consume_reset_token,
)
from app.application.auth.session_service import enforce_session_cap, revoke_all_sessions
from app.application.auth.mfa_service import user_has_mfa
from app.infrastructure.persistence.models import (
    AuditEventType,
    AuditLog,
    Device,
    OAuthAccount,
    OAuthProvider,
    Session,
    User,
    UserRole,
    UserStatus,
)
from app.infrastructure.security.passwords import hash_password, verify_password
from app.infrastructure.security.pending_auth import generate_pending_token, store_pending_auth
from app.infrastructure.security.rate_limit import check_rate_limit
from app.infrastructure.security.tokens import (
    create_access_token,
    generate_refresh_token,
    hash_token,
)
from app.infrastructure.security.turnstile import verify_turnstile


class AuthError(Exception):
    def __init__(self, message: str, code: str = "auth_error", status_code: int = 400):
        self.message = message
        self.code = code
        self.status_code = status_code
        super().__init__(message)


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _audit(
    db: AsyncSession,
    *,
    event_type: AuditEventType,
    user_id: UUID | None = None,
    ip: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    db.add(
        AuditLog(
            user_id=user_id,
            event_type=event_type,
            ip_address=ip,
            metadata_=metadata,
        )
    )


def _hash_fingerprint(fingerprint: str) -> str:
    return hash_token(fingerprint)


def _parse_user_agent(user_agent: str | None) -> tuple[str | None, str | None]:
    if not user_agent:
        return None, None
    browser = "Unknown"
    os_name = "Unknown"
    ua = user_agent.lower()
    if "chrome" in ua and "edg" not in ua:
        browser = "Chrome"
    elif "firefox" in ua:
        browser = "Firefox"
    elif "safari" in ua and "chrome" not in ua:
        browser = "Safari"
    elif "edg" in ua:
        browser = "Edge"
    if "windows" in ua:
        os_name = "Windows"
    elif "mac os" in ua or "macintosh" in ua:
        os_name = "macOS"
    elif "android" in ua:
        os_name = "Android"
    elif "iphone" in ua or "ipad" in ua:
        os_name = "iOS"
    elif "linux" in ua:
        os_name = "Linux"
    return os_name, browser


async def _get_or_create_device(
    db: AsyncSession,
    *,
    user: User,
    fingerprint: str,
    user_agent: str | None,
) -> tuple[Device, bool]:
    fp_hash = _hash_fingerprint(fingerprint)
    result = await db.execute(
        select(Device).where(Device.user_id == user.id, Device.fingerprint_hash == fp_hash)
    )
    device = result.scalar_one_or_none()
    if device:
        device.last_seen_at = _now()
        if user_agent:
            device.user_agent = user_agent
        return device, False

    os_name, browser = _parse_user_agent(user_agent)
    device = Device(
        user_id=user.id,
        fingerprint_hash=fp_hash,
        user_agent=user_agent,
        os=os_name,
        browser=browser,
    )
    db.add(device)
    await db.flush()
    return device, True


async def _create_session(
    db: AsyncSession,
    *,
    user: User,
    device: Device | None,
    settings: Settings,
    ip: str | None,
) -> tuple[str, str, Session]:
    await enforce_session_cap(db, user_id=user.id, settings=settings, ip=ip)

    refresh_token = generate_refresh_token()
    session = Session(
        user_id=user.id,
        device_id=device.id if device else None,
        refresh_token_hash=hash_token(refresh_token),
        expires_at=_now() + timedelta(days=settings.refresh_token_expire_days),
    )
    db.add(session)
    await db.flush()
    access_token = create_access_token(
        user_id=user.id,
        role=user.role.value,
        session_id=session.id,
        settings=settings,
    )
    await _audit(
        db,
        event_type=AuditEventType.session_created,
        user_id=user.id,
        ip=ip,
        metadata={"session_id": str(session.id)},
    )
    return access_token, refresh_token, session


async def _complete_authenticated_login(
    db: AsyncSession,
    *,
    user: User,
    device_fingerprint: str,
    user_agent: str | None,
    ip: str | None,
    settings: Settings | None = None,
    provider: str | None = None,
) -> dict[str, Any]:
    settings = settings or get_settings()

    if user.status == UserStatus.deleted:
        raise AuthError("Account is no longer available.", "account_deleted", 403)

    device, is_new_device = await _get_or_create_device(
        db, user=user, fingerprint=device_fingerprint, user_agent=user_agent
    )
    access_token, refresh_token, _ = await _create_session(
        db, user=user, device=device, settings=settings, ip=ip
    )
    metadata: dict[str, Any] = {}
    if provider:
        metadata["provider"] = provider
    await _audit(db, event_type=AuditEventType.login_success, user_id=user.id, ip=ip, metadata=metadata or None)
    if is_new_device:
        await _audit(
            db,
            event_type=AuditEventType.new_device_login,
            user_id=user.id,
            ip=ip,
            metadata={"device_id": str(device.id)},
        )
    return {
        "next": "authenticated",
        "user": user,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "new_device": is_new_device,
    }


async def _maybe_mfa_pending_login(
    user: User,
    *,
    device_fingerprint: str,
    user_agent: str | None,
    provider: str | None = None,
) -> dict[str, Any] | None:
    if not user_has_mfa(user):
        return None

    settings = get_settings()
    mfa_token = generate_pending_token()
    await store_pending_auth(
        "mfa_login",
        mfa_token,
        {
            "user_id": str(user.id),
            "device_fingerprint": device_fingerprint,
            "user_agent": user_agent,
            "provider": provider,
        },
        settings.mfa_pending_ttl_seconds,
    )
    return {
        "next": "mfa_required",
        "mfa_token": mfa_token,
        "expires_in": settings.mfa_pending_ttl_seconds,
    }


async def check_email(db: AsyncSession, email: str) -> dict[str, Any]:
    normalized = email.lower().strip()
    result = await db.execute(select(User).where(User.email == normalized))
    user = result.scalar_one_or_none()
    return {"exists": user is not None, "next": "login" if user else "signup"}


async def signup_start(
    db: AsyncSession,
    *,
    email: str,
    turnstile_token: str | None,
    ip: str | None,
) -> dict[str, str]:
    if not await check_rate_limit(f"signup:{ip or email}", 10, 3600):
        raise AuthError("Too many signup attempts. Try again later.", "rate_limited", 429)
    if not await verify_turnstile(turnstile_token, ip):
        raise AuthError("Bot verification failed.", "turnstile_failed", 403)

    normalized = email.lower().strip()
    result = await db.execute(select(User).where(User.email == normalized))
    if result.scalar_one_or_none():
        raise AuthError("An account with this email already exists.", "email_exists", 409)

    await generate_otp("email", normalized)
    signup_token = await create_signup_draft(normalized)
    return {"signup_token": signup_token}


async def signup_verify_email(signup_token: str, otp: str) -> dict[str, bool]:
    draft = await get_signup_draft(signup_token)
    if not draft:
        raise AuthError("Signup session expired. Please start again.", "signup_expired", 410)
    if not await verify_otp("email", draft["email"], otp):
        raise AuthError("Invalid or expired verification code.", "invalid_otp", 400)
    await update_signup_draft(signup_token, {"email_verified": True})
    return {"verified": True}


async def signup_set_password(signup_token: str, password: str) -> dict[str, bool]:
    draft = await get_signup_draft(signup_token)
    if not draft or not draft.get("email_verified"):
        raise AuthError("Verify your email before setting a password.", "email_not_verified", 400)
    await update_signup_draft(signup_token, {"password_hash": hash_password(password)})
    return {"ok": True}


async def signup_send_mobile_otp(signup_token: str, mobile: str, country_code: str = "IN") -> dict[str, bool]:
    draft = await get_signup_draft(signup_token)
    if not draft or not draft.get("password_hash"):
        raise AuthError("Set your password before verifying mobile.", "password_required", 400)

    digits = "".join(c for c in mobile if c.isdigit())
    if len(digits) != 10 or digits[0] not in "6789":
        raise AuthError("Enter a valid 10-digit mobile number.", "invalid_mobile", 400)

    await generate_otp("mobile", digits)
    await update_signup_draft(signup_token, {"mobile": digits, "country_code": country_code, "mobile_verified": False})
    return {"ok": True}


async def signup_verify_mobile(signup_token: str, otp: str) -> dict[str, bool]:
    draft = await get_signup_draft(signup_token)
    if not draft or not draft.get("mobile"):
        raise AuthError("Enter your mobile number first.", "mobile_required", 400)
    if not await verify_otp("mobile", draft["mobile"], otp):
        raise AuthError("Invalid or expired verification code.", "invalid_otp", 400)
    await update_signup_draft(signup_token, {"mobile_verified": True})
    return {"verified": True}


async def signup_complete(
    db: AsyncSession,
    *,
    signup_token: str,
    first_name: str,
    last_name: str,
    middle_name: str | None,
    device_fingerprint: str,
    user_agent: str | None,
    ip: str | None,
    settings: Settings | None = None,
) -> tuple[User, str, str]:
    settings = settings or get_settings()
    draft = await get_signup_draft(signup_token)
    if not draft or not draft.get("mobile_verified") or not draft.get("password_hash"):
        raise AuthError("Complete all signup steps first.", "signup_incomplete", 400)

    user = User(
        email=draft["email"],
        phone=draft["mobile"],
        password_hash=draft["password_hash"],
        first_name=first_name.strip(),
        middle_name=middle_name.strip() if middle_name else None,
        last_name=last_name.strip(),
        country_code=draft.get("country_code", "IN"),
        email_verified_at=_now(),
        phone_verified_at=_now(),
        role=UserRole.user,
    )
    db.add(user)
    await db.flush()

    device, _ = await _get_or_create_device(
        db, user=user, fingerprint=device_fingerprint, user_agent=user_agent
    )
    access_token, refresh_token, _ = await _create_session(
        db, user=user, device=device, settings=settings, ip=ip
    )
    await delete_signup_draft(signup_token)
    return user, access_token, refresh_token


async def login_with_email(
    db: AsyncSession,
    *,
    email: str,
    password: str,
    turnstile_token: str | None,
    device_fingerprint: str,
    user_agent: str | None,
    ip: str | None,
    settings: Settings | None = None,
) -> dict[str, Any]:
    settings = settings or get_settings()
    if not await check_rate_limit(f"login:{ip or email}", 20, 3600):
        raise AuthError("Too many login attempts. Try again later.", "rate_limited", 429)
    if not await verify_turnstile(turnstile_token, ip):
        raise AuthError("Bot verification failed.", "turnstile_failed", 403)

    normalized = email.lower().strip()
    result = await db.execute(select(User).where(User.email == normalized))
    user = result.scalar_one_or_none()

    if not user or not user.password_hash:
        await _audit(db, event_type=AuditEventType.login_failure, ip=ip, metadata={"email": normalized})
        raise AuthError("Invalid email or password.", "invalid_credentials", 401)

    if user.is_locked and user.locked_until and user.locked_until > _now():
        raise AuthError("Account is temporarily locked. Try again later.", "account_locked", 423)

    if not verify_password(user.password_hash, password):
        user.failed_login_count += 1
        if user.failed_login_count >= settings.lockout_max_attempts:
            user.is_locked = True
            user.locked_until = _now() + timedelta(minutes=settings.lockout_duration_minutes)
        await _audit(
            db,
            event_type=AuditEventType.login_failure,
            user_id=user.id,
            ip=ip,
        )
        raise AuthError("Invalid email or password.", "invalid_credentials", 401)

    user.failed_login_count = 0
    user.is_locked = False
    user.locked_until = None

    pending = await _maybe_mfa_pending_login(
        user,
        device_fingerprint=device_fingerprint,
        user_agent=user_agent,
    )
    if pending:
        return pending

    return await _complete_authenticated_login(
        db,
        user=user,
        device_fingerprint=device_fingerprint,
        user_agent=user_agent,
        ip=ip,
        settings=settings,
    )


async def login_with_google(
    db: AsyncSession,
    *,
    id_token: str,
    device_fingerprint: str,
    user_agent: str | None,
    ip: str | None,
    settings: Settings | None = None,
) -> dict[str, Any]:
    settings = settings or get_settings()
    if not settings.google_client_id:
        raise AuthError("Google Sign-In is not configured.", "google_not_configured", 503)

    try:
        idinfo = google_id_token.verify_oauth2_token(
            id_token, google_requests.Request(), settings.google_client_id
        )
    except Exception as exc:
        raise AuthError("Invalid Google token.", "invalid_google_token", 401) from exc

    google_sub = idinfo["sub"]
    email = idinfo.get("email", "").lower().strip()
    if not email:
        raise AuthError("Google account has no email.", "google_no_email", 400)

    oauth_result = await db.execute(
        select(OAuthAccount).where(
            OAuthAccount.provider == OAuthProvider.google,
            OAuthAccount.provider_user_id == google_sub,
        )
    )
    oauth_account = oauth_result.scalar_one_or_none()

    if oauth_account:
        user_result = await db.execute(select(User).where(User.id == oauth_account.user_id))
        user = user_result.scalar_one()
    else:
        user_result = await db.execute(select(User).where(User.email == email))
        user = user_result.scalar_one_or_none()
        if user:
            from app.application.auth.account_service import create_oauth_link_request

            return await create_oauth_link_request(
                db,
                user=user,
                provider=OAuthProvider.google,
                provider_user_id=google_sub,
                provider_email=email,
                ip=ip,
            )

        user = User(
            email=email,
            email_verified_at=_now(),
            role=UserRole.user,
        )
        db.add(user)
        await db.flush()
        oauth_account = OAuthAccount(
            user_id=user.id,
            provider=OAuthProvider.google,
            provider_user_id=google_sub,
            email=email,
        )
        db.add(oauth_account)

    pending = await _maybe_mfa_pending_login(
        user,
        device_fingerprint=device_fingerprint,
        user_agent=user_agent,
        provider="google",
    )
    if pending:
        return pending

    return await _complete_authenticated_login(
        db,
        user=user,
        device_fingerprint=device_fingerprint,
        user_agent=user_agent,
        ip=ip,
        settings=settings,
        provider="google",
    )


async def refresh_session(
    db: AsyncSession,
    *,
    refresh_token: str,
    ip: str | None,
    settings: Settings | None = None,
) -> tuple[str, str]:
    settings = settings or get_settings()
    token_hash = hash_token(refresh_token)
    result = await db.execute(
        select(Session).where(
            Session.refresh_token_hash == token_hash,
            Session.revoked_at.is_(None),
        )
    )
    session = result.scalar_one_or_none()
    if not session or session.expires_at <= _now():
        raise AuthError("Session expired. Please sign in again.", "session_expired", 401)

    user_result = await db.execute(select(User).where(User.id == session.user_id))
    user = user_result.scalar_one()

    session.revoked_at = _now()
    await _audit(
        db,
        event_type=AuditEventType.session_revoked,
        user_id=user.id,
        ip=ip,
        metadata={"session_id": str(session.id), "reason": "rotation"},
    )

    device = None
    if session.device_id:
        device_result = await db.execute(select(Device).where(Device.id == session.device_id))
        device = device_result.scalar_one_or_none()

    access_token, new_refresh_token, _ = await _create_session(
        db, user=user, device=device, settings=settings, ip=ip
    )
    return access_token, new_refresh_token


async def logout(db: AsyncSession, *, refresh_token: str, ip: str | None) -> None:
    token_hash = hash_token(refresh_token)
    result = await db.execute(select(Session).where(Session.refresh_token_hash == token_hash))
    session = result.scalar_one_or_none()
    if not session:
        return
    session.revoked_at = _now()
    await _audit(
        db,
        event_type=AuditEventType.logout,
        user_id=session.user_id,
        ip=ip,
        metadata={"session_id": str(session.id)},
    )
    await _audit(
        db,
        event_type=AuditEventType.session_revoked,
        user_id=session.user_id,
        ip=ip,
        metadata={"session_id": str(session.id), "reason": "logout"},
    )


async def forgot_password(
    db: AsyncSession,
    *,
    email: str,
    turnstile_token: str | None,
    ip: str | None,
) -> dict[str, bool]:
    if not await check_rate_limit(f"forgot:{ip or email}", 5, 3600):
        raise AuthError("Too many reset requests. Try again later.", "rate_limited", 429)
    if not await verify_turnstile(turnstile_token, ip):
        raise AuthError("Bot verification failed.", "turnstile_failed", 403)

    normalized = email.lower().strip()
    result = await db.execute(select(User).where(User.email == normalized))
    user = result.scalar_one_or_none()
    if user:
        token = await create_reset_token(str(user.id))
        settings = get_settings()
        reset_url = f"{settings.frontend_url}/reset-password?token={token}"
        if settings.debug:
            import logging
            logging.getLogger(__name__).info("[DEV RESET LINK] %s", reset_url)
        await _audit(
            db,
            event_type=AuditEventType.password_reset_requested,
            user_id=user.id,
            ip=ip,
        )
    return {"ok": True}


async def reset_password(
    db: AsyncSession,
    *,
    token: str,
    new_password: str,
    ip: str | None = None,
) -> dict[str, bool]:
    user_id = await consume_reset_token(token)
    if not user_id:
        raise AuthError("Invalid or expired reset link.", "invalid_reset_token", 400)
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise AuthError("User not found.", "user_not_found", 404)
    user.password_hash = hash_password(new_password)
    user.password_changed_at = _now()
    user.failed_login_count = 0
    user.is_locked = False
    user.locked_until = None
    await revoke_all_sessions(db, user_id=user.id, ip=ip, reason="password_reset")
    await _audit(db, event_type=AuditEventType.password_changed, user_id=user.id, ip=ip)
    return {"ok": True}


def user_to_public_dict(user: User) -> dict[str, Any]:
    from app.application.auth.account_service import fund_eligibility_status

    eligibility = fund_eligibility_status(user)
    return {
        "id": user.id,
        "email": user.email,
        "phone": user.phone,
        "first_name": user.first_name,
        "middle_name": user.middle_name,
        "last_name": user.last_name,
        "role": user.role.value,
        "country_code": user.country_code,
        "email_verified_at": user.email_verified_at,
        "phone_verified_at": user.phone_verified_at,
        "mfa_enrolled": user.mfa_enrolled_at is not None,
        "mfa_enrolled_at": user.mfa_enrolled_at,
        "fund_movement_eligible": eligibility["eligible"],
        "account_status": user.status.value,
        "deletion_scheduled_at": user.deletion_scheduled_at,
    }


async def get_user_by_id(db: AsyncSession, user_id: UUID) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()

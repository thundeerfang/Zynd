from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.mfa_service import (
    build_provisioning_uri,
    confirm_mfa_enrollment,
    generate_totp_secret,
    user_has_mfa,
    verify_user_backup_code,
    verify_user_totp,
)
from app.application.auth.service import AuthError
from app.application.auth.session_service import revoke_all_sessions
from app.core.config import Settings, get_settings
from app.infrastructure.otp.service import generate_otp, verify_otp
from app.infrastructure.persistence.models import (
    AuditEventType,
    DeletionEventType,
    DeletionLedger,
    OAuthLinkRequest,
    OAuthProvider,
    User,
    UserStatus,
)
from app.infrastructure.security.passwords import hash_password, verify_password
from app.infrastructure.security.pending_auth import (
    consume_pending_auth,
    generate_pending_token,
    has_step_up,
    store_pending_auth,
    store_step_up,
)
from app.infrastructure.security.rate_limit import check_rate_limit
from app.infrastructure.security.tokens import hash_token


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
    from app.infrastructure.persistence.models import AuditLog

    db.add(
        AuditLog(
            user_id=user_id,
            event_type=event_type,
            ip_address=ip,
            metadata_=metadata,
        )
    )


async def mfa_enroll_start(db: AsyncSession, user: User) -> dict[str, Any]:
    if user_has_mfa(user):
        raise AuthError("MFA is already enabled.", "mfa_already_enabled", 409)

    secret = generate_totp_secret()
    enroll_token = generate_pending_token()
    settings = get_settings()
    await store_pending_auth(
        "mfa_enroll",
        enroll_token,
        {"user_id": str(user.id), "secret": secret},
        settings.mfa_pending_ttl_seconds,
    )
    return {
        "enroll_token": enroll_token,
        "qr_uri": build_provisioning_uri(secret, user.email),
        "manual_secret": secret,
        "expires_in": settings.mfa_pending_ttl_seconds,
    }


async def mfa_enroll_confirm(
    db: AsyncSession,
    *,
    user: User,
    enroll_token: str,
    totp_code: str,
    ip: str | None,
) -> dict[str, Any]:
    payload = await consume_pending_auth("mfa_enroll", enroll_token)
    if not payload or payload.get("user_id") != str(user.id):
        raise AuthError("Enrollment session expired. Start again.", "enroll_expired", 410)

    try:
        backup_codes = await confirm_mfa_enrollment(
            db,
            user=user,
            secret=payload["secret"],
            totp_code=totp_code,
        )
    except ValueError as exc:
        raise AuthError("Invalid authenticator code.", "invalid_totp", 400) from exc

    await _audit(db, event_type=AuditEventType.mfa_enrolled, user_id=user.id, ip=ip)
    return {"enrolled": True, "backup_codes": backup_codes, "mfa_enrolled_at": user.mfa_enrolled_at}


async def verify_mfa_login(
    db: AsyncSession,
    *,
    mfa_token: str,
    totp_code: str | None,
    backup_code: str | None,
    ip: str | None,
) -> dict[str, Any]:
    settings = get_settings()
    payload = await consume_pending_auth("mfa_login", mfa_token)
    if not payload:
        raise AuthError("MFA session expired. Sign in again.", "mfa_expired", 410)

    user_id = UUID(payload["user_id"])
    if not await check_rate_limit(f"totp:{user_id}", 5, 600):
        raise AuthError("Too many MFA attempts. Try again later.", "rate_limited", 429)

    from app.application.auth.service import _complete_authenticated_login, get_user_by_id

    user = await get_user_by_id(db, user_id)
    if not user or not user_has_mfa(user):
        raise AuthError("Invalid MFA session.", "mfa_invalid", 400)

    verified = False
    used_backup = False
    if totp_code and not backup_code:
        verified = await verify_user_totp(db, user, totp_code)
    elif backup_code and not totp_code:
        verified = await verify_user_backup_code(db, user, backup_code)
        used_backup = verified
    else:
        raise AuthError("Provide either a TOTP code or a backup code.", "invalid_mfa_payload", 400)

    if not verified:
        await _audit(
            db,
            event_type=AuditEventType.mfa_challenge_failure,
            user_id=user.id,
            ip=ip,
        )
        raise AuthError("Invalid verification code.", "invalid_mfa_code", 401)

    await _audit(
        db,
        event_type=AuditEventType.mfa_challenge_success,
        user_id=user.id,
        ip=ip,
        metadata={"used_backup_code": used_backup},
    )
    if used_backup:
        await _audit(db, event_type=AuditEventType.backup_code_used, user_id=user.id, ip=ip)

    return await _complete_authenticated_login(
        db,
        user=user,
        device_fingerprint=payload["device_fingerprint"],
        user_agent=payload.get("user_agent"),
        ip=ip,
        settings=settings,
        provider=payload.get("provider"),
    )


async def create_oauth_link_request(
    db: AsyncSession,
    *,
    user: User,
    provider: OAuthProvider,
    provider_user_id: str,
    provider_email: str | None,
    ip: str | None,
) -> dict[str, Any]:
    settings = get_settings()
    link_token = generate_pending_token()
    token_hash = hash_token(link_token)

    link = OAuthLinkRequest(
        user_id=user.id,
        provider=provider,
        provider_user_id=provider_user_id,
        provider_email=provider_email,
        confirmation_token_hash=token_hash,
        expires_at=_now() + timedelta(seconds=settings.oauth_link_ttl_seconds),
    )
    db.add(link)
    await generate_otp("oauth_link", str(user.id))
    await _audit(
        db,
        event_type=AuditEventType.oauth_link_requested,
        user_id=user.id,
        ip=ip,
        metadata={"provider": provider.value},
    )
    await store_pending_auth(
        "oauth_link",
        link_token,
        {
            "user_id": str(user.id),
            "provider": provider.value,
            "provider_user_id": provider_user_id,
            "provider_email": provider_email,
            "link_id": str(link.id),
        },
        settings.oauth_link_ttl_seconds,
    )
    return {
        "next": "oauth_link_confirmation_required",
        "link_token": link_token,
        "expires_in": settings.oauth_link_ttl_seconds,
        "email_hint": _mask_email(user.email),
    }


def _mask_email(email: str) -> str:
    local, _, domain = email.partition("@")
    if len(local) <= 2:
        masked = local[0] + "*"
    else:
        masked = local[0] + "*" * (len(local) - 2) + local[-1]
    return f"{masked}@{domain}"


async def confirm_oauth_link(
    db: AsyncSession,
    *,
    link_token: str,
    email_otp: str,
    password: str,
    device_fingerprint: str,
    user_agent: str | None,
    ip: str | None,
) -> dict[str, Any]:
    payload = await consume_pending_auth("oauth_link", link_token)
    if not payload:
        raise AuthError("Link request expired. Try signing in again.", "link_expired", 410)

    from app.application.auth.service import _complete_authenticated_login, get_user_by_id
    from app.infrastructure.persistence.models import OAuthAccount

    user = await get_user_by_id(db, UUID(payload["user_id"]))
    if not user or not user.password_hash:
        raise AuthError("Account verification failed.", "link_invalid", 400)

    if not verify_password(user.password_hash, password):
        raise AuthError("Invalid password.", "invalid_credentials", 401)

    if not await verify_otp("oauth_link", str(user.id), email_otp):
        raise AuthError("Invalid or expired verification code.", "invalid_otp", 400)

    provider = OAuthProvider(payload["provider"])
    result = await db.execute(
        select(OAuthLinkRequest).where(OAuthLinkRequest.id == UUID(payload["link_id"]))
    )
    link = result.scalar_one_or_none()
    if not link or link.confirmed_at is not None or link.expires_at <= _now():
        raise AuthError("Link request expired.", "link_expired", 410)

    existing = await db.execute(
        select(OAuthAccount).where(
            OAuthAccount.provider == provider,
            OAuthAccount.provider_user_id == payload["provider_user_id"],
        )
    )
    if existing.scalar_one_or_none():
        raise AuthError("This provider account is already linked.", "oauth_exists", 409)

    link.confirmed_at = _now()
    db.add(
        OAuthAccount(
            user_id=user.id,
            provider=provider,
            provider_user_id=payload["provider_user_id"],
            email=payload.get("provider_email"),
        )
    )
    await _audit(
        db,
        event_type=AuditEventType.oauth_link_confirmed,
        user_id=user.id,
        ip=ip,
        metadata={"provider": provider.value},
    )

    pending = await _maybe_mfa_pending_login(
        user,
        device_fingerprint=device_fingerprint,
        user_agent=user_agent,
        provider=provider.value,
    )
    if pending:
        return pending

    return await _complete_authenticated_login(
        db,
        user=user,
        device_fingerprint=device_fingerprint,
        user_agent=user_agent,
        ip=ip,
        provider=provider.value,
    )


async def _maybe_mfa_pending_login(
    user: User,
    *,
    device_fingerprint: str,
    user_agent: str | None,
    provider: str | None = None,
) -> dict[str, Any] | None:
    from app.application.auth.service import _maybe_mfa_pending_login as pending

    return await pending(
        user,
        device_fingerprint=device_fingerprint,
        user_agent=user_agent,
        provider=provider,
    )


async def verify_step_up(
    db: AsyncSession,
    *,
    user: User,
    session_id: UUID,
    current_password: str,
    totp_code: str | None,
    ip: str | None,
) -> dict[str, bool]:
    if not user.password_hash or not verify_password(user.password_hash, current_password):
        raise AuthError("Invalid password.", "invalid_credentials", 401)

    if user_has_mfa(user):
        if not totp_code or not await verify_user_totp(db, user, totp_code):
            raise AuthError("Valid authenticator code required.", "invalid_totp", 401)

    settings = get_settings()
    await store_step_up(str(user.id), str(session_id), settings.step_up_ttl_seconds)
    return {"verified": True}


async def change_password(
    db: AsyncSession,
    *,
    user: User,
    session_id: UUID,
    current_password: str,
    new_password: str,
    totp_code: str | None,
    ip: str | None,
) -> dict[str, bool]:
    await verify_step_up(
        db,
        user=user,
        session_id=session_id,
        current_password=current_password,
        totp_code=totp_code,
        ip=ip,
    )
    user.password_hash = hash_password(new_password)
    user.password_changed_at = _now()
    await revoke_all_sessions(db, user_id=user.id, ip=ip, except_session_id=session_id)
    await _audit(db, event_type=AuditEventType.password_changed, user_id=user.id, ip=ip)
    return {"ok": True}


async def change_email_start(
    db: AsyncSession,
    *,
    user: User,
    session_id: UUID,
    new_email: str,
    current_password: str,
    totp_code: str | None,
    ip: str | None,
) -> dict[str, str]:
    await verify_step_up(
        db,
        user=user,
        session_id=session_id,
        current_password=current_password,
        totp_code=totp_code,
        ip=ip,
    )

    normalized = new_email.lower().strip()
    existing = await db.execute(select(User).where(User.email == normalized))
    if existing.scalar_one_or_none():
        raise AuthError("An account with this email already exists.", "email_exists", 409)

    change_token = generate_pending_token()
    settings = get_settings()
    await generate_otp("email_change", normalized)
    await store_pending_auth(
        "email_change",
        change_token,
        {"user_id": str(user.id), "new_email": normalized},
        settings.oauth_link_ttl_seconds,
    )
    await _audit(
        db,
        event_type=AuditEventType.email_change_requested,
        user_id=user.id,
        ip=ip,
        metadata={"new_email": normalized},
    )
    return {"change_token": change_token}


async def change_email_confirm(
    db: AsyncSession,
    *,
    user: User,
    session_id: UUID,
    change_token: str,
    otp: str,
    ip: str | None,
) -> dict[str, bool]:
    if not await has_step_up(str(user.id), str(session_id)):
        raise AuthError("Re-authenticate before confirming email change.", "step_up_required", 403)

    payload = await consume_pending_auth("email_change", change_token)
    if not payload or payload.get("user_id") != str(user.id):
        raise AuthError("Email change session expired.", "change_expired", 410)

    new_email = payload["new_email"]
    if not await verify_otp("email_change", new_email, otp):
        raise AuthError("Invalid or expired verification code.", "invalid_otp", 400)

    user.email = new_email
    user.email_verified_at = _now()
    user.email_changed_at = _now()
    await revoke_all_sessions(db, user_id=user.id, ip=ip, except_session_id=session_id)
    await _audit(db, event_type=AuditEventType.email_changed, user_id=user.id, ip=ip)
    return {"ok": True}


async def request_account_deletion(
    db: AsyncSession,
    *,
    user: User,
    session_id: UUID,
    current_password: str,
    totp_code: str | None,
    ip: str | None,
) -> dict[str, Any]:
    await verify_step_up(
        db,
        user=user,
        session_id=session_id,
        current_password=current_password,
        totp_code=totp_code,
        ip=ip,
    )

    settings = get_settings()
    user.status = UserStatus.deletion_pending
    user.deletion_requested_at = _now()
    user.deletion_scheduled_at = _now() + timedelta(days=settings.account_deletion_grace_days)

    db.add(
        DeletionLedger(
            user_id=user.id,
            event_type=DeletionEventType.deletion_requested,
            retention_policy="dpdp_grace_30d",
            metadata_={"channel": "web"},
        )
    )
    await revoke_all_sessions(db, user_id=user.id, ip=ip, except_session_id=session_id)
    await _audit(
        db,
        event_type=AuditEventType.account_deletion_requested,
        user_id=user.id,
        ip=ip,
    )
    return {"ok": True, "deletion_scheduled_at": user.deletion_scheduled_at}


async def cancel_account_deletion(
    db: AsyncSession,
    *,
    user: User,
    ip: str | None,
) -> dict[str, bool]:
    if user.status != UserStatus.deletion_pending:
        raise AuthError("No pending deletion request.", "no_deletion_pending", 400)

    user.status = UserStatus.active
    user.deletion_requested_at = None
    user.deletion_scheduled_at = None
    db.add(
        DeletionLedger(
            user_id=user.id,
            event_type=DeletionEventType.deletion_cancelled,
            retention_policy="dpdp_grace_30d",
            metadata_={"channel": "web"},
        )
    )
    await _audit(
        db,
        event_type=AuditEventType.account_deletion_cancelled,
        user_id=user.id,
        ip=ip,
    )
    return {"ok": True}


def fund_eligibility_status(user: User) -> dict[str, Any]:
    reasons: list[str] = []
    if user.status != UserStatus.active:
        reasons.append("account_inactive")
    if user.mfa_required_for_funds and not user_has_mfa(user):
        reasons.append("mfa_required")
    return {"eligible": not reasons, "reasons": reasons}

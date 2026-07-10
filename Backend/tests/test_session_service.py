from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.session_service import enforce_session_cap, get_active_sessions
from app.core.config import Settings
from app.infrastructure.persistence.models import Device, Session, User, UserRole, UserStatus


def _now() -> datetime:
    return datetime.now(timezone.utc)


@pytest.mark.asyncio
async def test_enforce_session_cap_revokes_oldest(db_session: AsyncSession) -> None:
    user = User(
        email=f"cap-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    device = Device(
        user_id=user.id,
        fingerprint_hash=f"fp-{uuid4()}",
        os="macOS",
        browser="Safari",
    )
    db_session.add(device)
    await db_session.flush()

    settings = Settings(max_concurrent_sessions=3)
    expires = _now() + timedelta(days=30)
    sessions: list[Session] = []
    for index in range(4):
        session = Session(
            user_id=user.id,
            device_id=device.id,
            refresh_token_hash=f"hash-{index}",
            expires_at=expires,
            last_used_at=_now() - timedelta(minutes=10 - index),
        )
        db_session.add(session)
        sessions.append(session)
    await db_session.flush()

    await enforce_session_cap(
        db_session,
        user_id=user.id,
        settings=settings,
        exclude_session_id=sessions[-1].id,
    )
    await db_session.flush()

    active = await get_active_sessions(db_session, user.id)
    assert len(active) == 3
    assert sessions[0].revoked_at is not None
    assert sessions[-1].revoked_at is None

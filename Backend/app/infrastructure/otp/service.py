from __future__ import annotations

import json
import logging
import random
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.config import get_settings
from app.core.redis import get_redis

logger = logging.getLogger(__name__)

OTP_TTL_SECONDS = 600
OTP_MAX_ATTEMPTS = 5
SIGNUP_TTL_SECONDS = 1800


def _otp_key(purpose: str, identifier: str) -> str:
    return f"otp:{purpose}:{identifier}"


def _signup_key(token: str) -> str:
    return f"signup:{token}"


def _dev_otp_code(settings) -> str | None:
    if settings.debug and settings.dev_otp:
        return settings.dev_otp.strip()
    return None


async def generate_otp(purpose: str, identifier: str) -> str:
    settings = get_settings()
    dev_code = _dev_otp_code(settings)
    code = dev_code if dev_code else f"{random.randint(0, 999999):06d}"
    redis = await get_redis(settings.redis_cache_db)
    payload = {"code": code, "attempts": 0}
    await redis.setex(_otp_key(purpose, identifier), OTP_TTL_SECONDS, json.dumps(payload))

    if settings.debug:
        logger.info("[DEV OTP] purpose=%s identifier=%s code=%s", purpose, identifier, code)

    return code


async def verify_otp(purpose: str, identifier: str, code: str) -> bool:
    settings = get_settings()
    normalized_code = code.strip()
    dev_code = _dev_otp_code(settings)
    if dev_code and normalized_code == dev_code:
        redis = await get_redis(settings.redis_cache_db)
        await redis.delete(_otp_key(purpose, identifier))
        return True

    redis = await get_redis(settings.redis_cache_db)
    key = _otp_key(purpose, identifier)
    raw = await redis.get(key)
    if not raw:
        return False

    payload = json.loads(raw)
    if payload.get("attempts", 0) >= OTP_MAX_ATTEMPTS:
        await redis.delete(key)
        return False

    if payload.get("code") != normalized_code:
        payload["attempts"] = payload.get("attempts", 0) + 1
        ttl = await redis.ttl(key)
        if ttl > 0:
            await redis.setex(key, ttl, json.dumps(payload))
        return False

    await redis.delete(key)
    return True


async def create_signup_draft(email: str) -> str:
    settings = get_settings()
    token = secrets.token_urlsafe(32)
    redis = await get_redis(settings.redis_cache_db)
    draft: dict[str, Any] = {
        "email": email.lower().strip(),
        "email_verified": False,
        "password_hash": None,
        "mobile": None,
        "mobile_verified": False,
        "country_code": "IN",
    }
    await redis.setex(_signup_key(token), SIGNUP_TTL_SECONDS, json.dumps(draft))
    return token


async def get_signup_draft(token: str) -> dict[str, Any] | None:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    raw = await redis.get(_signup_key(token))
    if not raw:
        return None
    return json.loads(raw)


async def update_signup_draft(token: str, updates: dict[str, Any]) -> dict[str, Any] | None:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    key = _signup_key(token)
    raw = await redis.get(key)
    if not raw:
        return None
    draft = json.loads(raw)
    draft.update(updates)
    ttl = await redis.ttl(key)
    if ttl <= 0:
        ttl = SIGNUP_TTL_SECONDS
    await redis.setex(key, ttl, json.dumps(draft))
    return draft


async def delete_signup_draft(token: str) -> None:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    await redis.delete(_signup_key(token))


async def create_reset_token(user_id: str) -> str:
    settings = get_settings()
    token = secrets.token_urlsafe(32)
    redis = await get_redis(settings.redis_cache_db)
    await redis.setex(f"reset:{token}", 3600, user_id)
    if settings.debug:
        logger.info("[DEV RESET] user_id=%s token=%s", user_id, token)
    return token


async def consume_reset_token(token: str) -> str | None:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    key = f"reset:{token}"
    user_id = await redis.get(key)
    if not user_id:
        return None
    await redis.delete(key)
    return user_id

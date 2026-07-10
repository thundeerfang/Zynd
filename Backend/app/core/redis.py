from __future__ import annotations

from collections.abc import AsyncGenerator

import redis.asyncio as redis

from app.core.config import Settings, get_settings

_redis_clients: dict[int, redis.Redis] = {}


def _build_redis_url(base_url: str, db: int) -> str:
    """Replace or append DB index on a redis:// URL."""
    if "/" in base_url.rsplit(":", 1)[-1]:
        return base_url.rsplit("/", 1)[0] + f"/{db}"
    return f"{base_url}/{db}"


async def get_redis(db: int | None = None, settings: Settings | None = None) -> redis.Redis:
    settings = settings or get_settings()
    db_index = db if db is not None else 0

    if db_index not in _redis_clients:
        url = _build_redis_url(settings.redis_url, db_index)
        _redis_clients[db_index] = redis.from_url(url, decode_responses=True)

    return _redis_clients[db_index]


async def close_redis() -> None:
    for client in _redis_clients.values():
        await client.aclose()
    _redis_clients.clear()


async def redis_dependency() -> AsyncGenerator[redis.Redis, None]:
    client = await get_redis()
    yield client

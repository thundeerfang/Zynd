from __future__ import annotations

import redis.asyncio as redis

from app.core.config import Settings, get_settings
from app.core.redis import get_redis
from app.domain.shared.events import DomainEvent
from app.infrastructure.messaging.event_bus import EventBus


class RedisEventBus(EventBus):
    """Phase 1 event bus — Redis Streams adapter."""

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._client: redis.Redis | None = None

    async def _get_client(self) -> redis.Redis:
        if self._client is None:
            self._client = await get_redis(self._settings.redis_event_stream_db)
        return self._client

    def _stream_name(self, stream: str) -> str:
        return f"{self._settings.event_stream_prefix}.{stream}"

    async def publish(self, stream: str, event: DomainEvent) -> str:
        client = await self._get_client()
        message_id = await client.xadd(
            self._stream_name(stream),
            {"data": event.model_dump_json()},
        )
        return message_id

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

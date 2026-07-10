from fastapi import APIRouter

from app.core.config import get_settings
from app.core.redis import get_redis

router = APIRouter(tags=["health"])
settings = get_settings()


@router.get("/health")
async def health_check() -> dict:
    return {
        "status": "ok",
        "app": settings.app_name,
        "env": settings.app_env,
    }


@router.get("/health/redis")
async def redis_health() -> dict:
    client = await get_redis()
    pong = await client.ping()
    return {"status": "ok" if pong else "error", "redis": "connected" if pong else "disconnected"}

from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.redis import close_redis

load_dotenv()

# Settings are cached; ensure env is loaded before the first read.
get_settings.cache_clear()
settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    await close_redis()


app = FastAPI(
    title=settings.app_name,
    description="ZYND Wealth Operating System — Event-first API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/")
async def root() -> dict:
    return {
        "name": settings.app_name,
        "version": "0.1.0",
        "docs": "/docs",
    }

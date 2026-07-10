from fastapi import APIRouter

from app.api.v1 import health
from app.api.v1.auth.router import router as auth_router

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth_router)

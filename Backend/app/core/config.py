from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "ZYND API"
    app_env: Literal["development", "staging", "production"] = "development"
    debug: bool = True
    dev_otp: str = ""
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_prefix: str = "/api/v1"

    cors_origins: str = (
        "http://localhost:7777,http://localhost:8888,"
        "http://127.0.0.1:7777,http://127.0.0.1:8888"
    )

    database_url: str = "postgresql+asyncpg://zynd:zynd@localhost:5432/zynd"

    redis_url: str = "redis://localhost:6379/0"
    redis_session_db: int = 1
    redis_cache_db: int = 2
    redis_event_stream_db: int = 3

    secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30

    google_client_id: str = ""
    turnstile_secret_key: str = ""

    lockout_max_attempts: int = 5
    lockout_duration_minutes: int = 15

    mfa_encryption_key: str = ""
    max_concurrent_sessions: int = 3
    mfa_pending_ttl_seconds: int = 300
    oauth_link_ttl_seconds: int = 900
    step_up_ttl_seconds: int = 600
    account_deletion_grace_days: int = 30

    @property
    def resolved_mfa_encryption_key(self) -> str:
        return self.mfa_encryption_key or self.secret_key

    frontend_url: str = "http://localhost:7777"
    refresh_cookie_name: str = "zynd_refresh_token"
    refresh_cookie_secure: bool = False
    refresh_cookie_samesite: str = "lax"

    event_bus_adapter: Literal["redis", "kafka"] = "redis"
    event_stream_prefix: str = "zynd"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

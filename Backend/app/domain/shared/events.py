from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


class DomainEvent(BaseModel):
    """Standard ZYND domain event envelope."""

    event_id: str = Field(default_factory=lambda: str(uuid4()))
    event_type: str
    schema_version: int = 1
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    correlation_id: str | None = None
    causation_id: str | None = None
    aggregate_id: str
    aggregate_type: str
    payload: dict[str, Any] = Field(default_factory=dict)

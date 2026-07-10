from abc import ABC, abstractmethod

from app.domain.shared.events import DomainEvent


class EventBus(ABC):
    @abstractmethod
    async def publish(self, stream: str, event: DomainEvent) -> str:
        """Publish an event and return the message ID."""

    @abstractmethod
    async def close(self) -> None:
        """Release messaging resources."""

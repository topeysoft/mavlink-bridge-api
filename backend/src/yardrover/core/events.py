"""Async event bus for system-wide event management."""

import asyncio
from collections import defaultdict
from typing import Any, Awaitable, Callable, Optional

import structlog

from yardrover.core.errors import EventError, EventSubscriptionError

logger = structlog.get_logger(__name__)

# Event handler type
EventHandler = Callable[[str, Any], Awaitable[None]]


class EventBus:
    """Async event bus for publish-subscribe pattern.

    Replaces FreeRTOS queue-based event system from C++ implementation.
    Provides type-safe async event distribution with wildcard support.
    """

    # High-frequency events that should not be logged at DEBUG level
    _QUIET_EVENTS = {"mavlink.message", "telemetry.update"}

    def __init__(self) -> None:
        """Initialize event bus."""
        self._subscribers: dict[str, list[EventHandler]] = defaultdict(list)
        self._wildcard_subscribers: list[EventHandler] = []
        self._lock = asyncio.Lock()

    async def emit(self, event: str, data: Any = None) -> None:
        """Emit event to all subscribers.

        Args:
            event: Event name (e.g., 'config_changed', 'mavlink_message')
            data: Event payload data

        Note:
            Events are delivered asynchronously. Errors in handlers are logged
            but do not prevent other handlers from executing.
        """
        async with self._lock:
            # Get specific subscribers
            subscribers = self._subscribers.get(event, []).copy()
            # Add wildcard subscribers
            subscribers.extend(self._wildcard_subscribers)

        if not subscribers:
            # Only log if not a high-frequency event
            if event not in self._QUIET_EVENTS:
                logger.debug("event_emitted_no_subscribers", event_name=event)
            return

        # Only log if not a high-frequency event
        if event not in self._QUIET_EVENTS:
            logger.debug(
                "event_emitted",
                event_name=event,
                subscriber_count=len(subscribers),
                has_data=data is not None,
            )

        # Execute all handlers concurrently
        tasks = [self._safe_handler_call(handler, event, data) for handler in subscribers]
        await asyncio.gather(*tasks, return_exceptions=True)

    async def publish(self, event: str, data: Any = None) -> None:
        """Alias for emit() for compatibility.

        Args:
            event: Event name
            data: Event payload data
        """
        await self.emit(event, data)

    async def _safe_handler_call(
        self, handler: EventHandler, event: str, data: Any
    ) -> None:
        """Call event handler with error handling.

        Args:
            handler: Event handler function
            event: Event name
            data: Event data
        """
        try:
            await handler(event, data)
        except Exception:
            logger.exception(
                "event_handler_error",
                event_name=event,
                handler_name=handler.__name__,
            )

    async def subscribe(self, event: str, handler: EventHandler) -> None:
        """Subscribe to an event.

        Args:
            event: Event name to subscribe to, or '*' for all events
            handler: Async callback function

        Raises:
            EventSubscriptionError: If subscription fails
        """
        if not callable(handler):
            raise EventSubscriptionError(f"Handler must be callable: {handler}")

        async with self._lock:
            if event == "*":
                if handler not in self._wildcard_subscribers:
                    self._wildcard_subscribers.append(handler)
                    logger.debug("subscribed_to_all_events", handler_name=handler.__name__)
            else:
                if handler not in self._subscribers[event]:
                    self._subscribers[event].append(handler)
                    logger.debug(
                        "subscribed_to_event",
                        event_name=event,
                        handler_name=handler.__name__,
                    )

    async def unsubscribe(self, event: str, handler: EventHandler) -> None:
        """Unsubscribe from an event.

        Args:
            event: Event name to unsubscribe from, or '*' for all events
            handler: Handler function to remove
        """
        async with self._lock:
            if event == "*":
                if handler in self._wildcard_subscribers:
                    self._wildcard_subscribers.remove(handler)
                    logger.debug("unsubscribed_from_all_events", handler_name=handler.__name__)
            else:
                if event in self._subscribers and handler in self._subscribers[event]:
                    self._subscribers[event].remove(handler)
                    logger.debug(
                        "unsubscribed_from_event",
                        event_name=event,
                        handler_name=handler.__name__,
                    )

                    # Clean up empty subscriber lists
                    if not self._subscribers[event]:
                        del self._subscribers[event]

    async def clear(self, event: Optional[str] = None) -> None:
        """Clear subscribers for an event or all events.

        Args:
            event: Event name to clear, or None to clear all
        """
        async with self._lock:
            if event is None:
                self._subscribers.clear()
                self._wildcard_subscribers.clear()
                logger.debug("cleared_all_subscriptions")
            elif event == "*":
                self._wildcard_subscribers.clear()
                logger.debug("cleared_wildcard_subscriptions")
            elif event in self._subscribers:
                del self._subscribers[event]
                logger.debug("cleared_event_subscriptions", event_name=event)

    def get_subscriber_count(self, event: Optional[str] = None) -> int:
        """Get number of subscribers for an event.

        Args:
            event: Event name, or None for total count

        Returns:
            Number of subscribers
        """
        if event is None:
            total = sum(len(handlers) for handlers in self._subscribers.values())
            total += len(self._wildcard_subscribers)
            return total
        elif event == "*":
            return len(self._wildcard_subscribers)
        else:
            return len(self._subscribers.get(event, []))


# Global event bus instance
_event_bus: Optional[EventBus] = None


def get_event_bus() -> EventBus:
    """Get global event bus instance.

    Returns:
        Global EventBus instance
    """
    global _event_bus
    if _event_bus is None:
        _event_bus = EventBus()
    return _event_bus

"""Unit tests for event bus system."""

import pytest

from yardrover.core.events import EventBus


class TestEventBus:
    """Tests for EventBus class."""

    @pytest.fixture
    async def event_bus(self) -> EventBus:
        """Create event bus for testing."""
        bus = EventBus()
        yield bus
        await bus.clear()

    async def test_subscribe_and_emit(self, event_bus: EventBus) -> None:
        """Test basic event subscription and emission."""
        received_events: list[tuple[str, any]] = []

        async def handler(event: str, data: any) -> None:
            received_events.append((event, data))

        await event_bus.subscribe("test_event", handler)
        await event_bus.emit("test_event", {"value": 42})

        assert len(received_events) == 1
        assert received_events[0][0] == "test_event"
        assert received_events[0][1] == {"value": 42}

    async def test_wildcard_subscription(self, event_bus: EventBus) -> None:
        """Test wildcard event subscription."""
        received_events: list[str] = []

        async def handler(event: str, data: any) -> None:
            received_events.append(event)

        await event_bus.subscribe("*", handler)
        await event_bus.emit("event1", None)
        await event_bus.emit("event2", None)

        assert len(received_events) == 2
        assert "event1" in received_events
        assert "event2" in received_events

    async def test_multiple_subscribers(self, event_bus: EventBus) -> None:
        """Test multiple subscribers to same event."""
        counter1 = {"count": 0}
        counter2 = {"count": 0}

        async def handler1(event: str, data: any) -> None:
            counter1["count"] += 1

        async def handler2(event: str, data: any) -> None:
            counter2["count"] += 1

        await event_bus.subscribe("test", handler1)
        await event_bus.subscribe("test", handler2)
        await event_bus.emit("test", None)

        assert counter1["count"] == 1
        assert counter2["count"] == 1

    async def test_unsubscribe(self, event_bus: EventBus) -> None:
        """Test event unsubscription."""
        received_events: list[str] = []

        async def handler(event: str, data: any) -> None:
            received_events.append(event)

        await event_bus.subscribe("test", handler)
        await event_bus.emit("test", None)

        await event_bus.unsubscribe("test", handler)
        await event_bus.emit("test", None)

        assert len(received_events) == 1

    async def test_subscriber_count(self, event_bus: EventBus) -> None:
        """Test getting subscriber count."""
        async def handler1(event: str, data: any) -> None:
            pass

        async def handler2(event: str, data: any) -> None:
            pass

        assert event_bus.get_subscriber_count("test") == 0

        await event_bus.subscribe("test", handler1)
        assert event_bus.get_subscriber_count("test") == 1

        await event_bus.subscribe("test", handler2)
        assert event_bus.get_subscriber_count("test") == 2

        await event_bus.unsubscribe("test", handler1)
        assert event_bus.get_subscriber_count("test") == 1

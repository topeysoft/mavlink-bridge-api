"""Unit tests for WebSocket manager."""

import asyncio
import json
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import WebSocket

from yardrover.core.events import EventBus
from yardrover.models.websocket import (
    MessageType,
    SubscribeMessage,
    WebSocketMessage,
)
from yardrover.network.websocket import WebSocketConnection, WebSocketManager


@pytest.fixture
def event_bus():
    """Create event bus instance."""
    return EventBus()


@pytest.fixture
def ws_manager(event_bus):
    """Create WebSocket manager instance."""
    return WebSocketManager(event_bus)


@pytest.fixture
def mock_websocket():
    """Create mock WebSocket."""
    ws = AsyncMock(spec=WebSocket)
    ws.client = MagicMock()
    ws.client.host = "127.0.0.1"
    ws.query_params = {}
    return ws


class TestWebSocketConnection:
    """Tests for WebSocketConnection class."""

    def test_connection_initialization(self, mock_websocket):
        """Test connection initialization."""
        conn = WebSocketConnection(mock_websocket, "test-id", "127.0.0.1")

        assert conn.connection_id == "test-id"
        assert conn.remote_address == "127.0.0.1"
        assert conn.websocket == mock_websocket
        assert len(conn.subscriptions) == 0
        assert conn.message_count == 0

    def test_connection_info(self, mock_websocket):
        """Test getting connection info."""
        conn = WebSocketConnection(mock_websocket, "test-id", "127.0.0.1")
        conn.subscribe(["health.*", "wifi.*"])

        info = conn.info

        assert info.connection_id == "test-id"
        assert info.remote_address == "127.0.0.1"
        assert set(info.subscriptions) == {"health.*", "wifi.*"}
        assert isinstance(info.connected_at, datetime)

    @pytest.mark.asyncio
    async def test_send_message(self, mock_websocket):
        """Test sending message to client."""
        conn = WebSocketConnection(mock_websocket, "test-id", "127.0.0.1")

        message = WebSocketMessage(
            type=MessageType.HEARTBEAT,
            data={"sequence": 1}
        )

        await conn.send_message(message)

        mock_websocket.send_json.assert_called_once()
        assert conn.message_count == 1

    @pytest.mark.asyncio
    async def test_send_error(self, mock_websocket):
        """Test sending error message."""
        conn = WebSocketConnection(mock_websocket, "test-id", "127.0.0.1")

        await conn.send_error("TEST_ERROR", "Test error message", {"detail": "info"})

        mock_websocket.send_json.assert_called_once()
        call_args = mock_websocket.send_json.call_args[0][0]
        assert call_args["type"] == MessageType.ERROR
        assert call_args["data"]["code"] == "TEST_ERROR"
        assert call_args["data"]["message"] == "Test error message"

    def test_subscribe(self, mock_websocket):
        """Test subscribing to topics."""
        conn = WebSocketConnection(mock_websocket, "test-id", "127.0.0.1")

        conn.subscribe(["health.*", "wifi.status"])

        assert "health.*" in conn.subscriptions
        assert "wifi.status" in conn.subscriptions
        assert len(conn.subscriptions) == 2

    def test_unsubscribe(self, mock_websocket):
        """Test unsubscribing from topics."""
        conn = WebSocketConnection(mock_websocket, "test-id", "127.0.0.1")

        conn.subscribe(["health.*", "wifi.status", "config.*"])
        conn.unsubscribe(["wifi.status"])

        assert "health.*" in conn.subscriptions
        assert "config.*" in conn.subscriptions
        assert "wifi.status" not in conn.subscriptions
        assert len(conn.subscriptions) == 2

    def test_is_subscribed_to_exact_match(self, mock_websocket):
        """Test topic subscription with exact match."""
        conn = WebSocketConnection(mock_websocket, "test-id", "127.0.0.1")
        conn.subscribe(["health.update", "wifi.status"])

        assert conn.is_subscribed_to("health.update")
        assert conn.is_subscribed_to("wifi.status")
        assert not conn.is_subscribed_to("health.error")

    def test_is_subscribed_to_wildcard(self, mock_websocket):
        """Test topic subscription with wildcard."""
        conn = WebSocketConnection(mock_websocket, "test-id", "127.0.0.1")
        conn.subscribe(["health.*"])

        assert conn.is_subscribed_to("health.update")
        assert conn.is_subscribed_to("health.error")
        assert conn.is_subscribed_to("health.warning")
        assert not conn.is_subscribed_to("wifi.status")

    def test_is_subscribed_to_all(self, mock_websocket):
        """Test subscription to all topics."""
        conn = WebSocketConnection(mock_websocket, "test-id", "127.0.0.1")
        conn.subscribe(["*"])

        assert conn.is_subscribed_to("health.update")
        assert conn.is_subscribed_to("wifi.status")
        assert conn.is_subscribed_to("anything.else")


class TestWebSocketManager:
    """Tests for WebSocketManager class."""

    def test_manager_initialization(self, ws_manager):
        """Test manager initialization."""
        assert len(ws_manager.connections) == 0
        assert ws_manager.total_connections == 0
        assert ws_manager.messages_sent == 0
        assert ws_manager.messages_received == 0

    @pytest.mark.asyncio
    async def test_start_stop(self, ws_manager):
        """Test starting and stopping manager."""
        await ws_manager.start()
        assert ws_manager._running is True

        await ws_manager.stop()
        assert ws_manager._running is False

    @pytest.mark.asyncio
    async def test_connect(self, ws_manager, mock_websocket):
        """Test accepting new connection."""
        await ws_manager.start()

        connection = await ws_manager.connect(mock_websocket)

        mock_websocket.accept.assert_called_once()
        assert connection.connection_id in ws_manager.connections
        assert ws_manager.total_connections == 1
        assert len(ws_manager.connections) == 1

    @pytest.mark.asyncio
    async def test_disconnect(self, ws_manager, mock_websocket):
        """Test disconnecting client."""
        await ws_manager.start()
        connection = await ws_manager.connect(mock_websocket)

        await ws_manager.disconnect(connection.connection_id)

        assert connection.connection_id not in ws_manager.connections
        assert len(ws_manager.connections) == 0

    @pytest.mark.asyncio
    async def test_handle_subscribe_message(self, ws_manager, mock_websocket):
        """Test handling subscribe message."""
        await ws_manager.start()
        connection = await ws_manager.connect(mock_websocket)

        message = WebSocketMessage(
            type=MessageType.SUBSCRIBE,
            data=SubscribeMessage(topics=["health.*", "wifi.*"]).model_dump()
        )

        await ws_manager.handle_message(connection, message.model_dump_json())

        assert "health.*" in connection.subscriptions
        assert "wifi.*" in connection.subscriptions
        assert ws_manager.messages_received == 1

    @pytest.mark.asyncio
    async def test_handle_ping_message(self, ws_manager, mock_websocket):
        """Test handling ping message."""
        await ws_manager.start()
        connection = await ws_manager.connect(mock_websocket)

        message = WebSocketMessage(
            type=MessageType.PING,
            data={"timestamp": "2024-01-01T00:00:00"}
        )

        await ws_manager.handle_message(connection, message.model_dump_json())

        # Should send pong response
        assert mock_websocket.send_json.call_count >= 1

    @pytest.mark.asyncio
    async def test_broadcast_to_all(self, ws_manager, mock_websocket):
        """Test broadcasting to all connections."""
        await ws_manager.start()

        # Create multiple connections
        conn1 = await ws_manager.connect(mock_websocket)
        conn2 = await ws_manager.connect(AsyncMock(spec=WebSocket, client=MagicMock(host="127.0.0.2"), query_params={}))

        message = WebSocketMessage(
            type=MessageType.HEALTH_UPDATE,
            data={"status": "ok"}
        )

        sent_count = await ws_manager.broadcast(message)

        assert sent_count == 2

    @pytest.mark.asyncio
    async def test_broadcast_with_topic_filter(self, ws_manager, mock_websocket):
        """Test broadcasting with topic filtering."""
        await ws_manager.start()

        # Create connections with different subscriptions
        conn1 = await ws_manager.connect(mock_websocket)
        conn1.subscribe(["health.*"])

        mock_ws2 = AsyncMock(spec=WebSocket, client=MagicMock(host="127.0.0.2"), query_params={})
        conn2 = await ws_manager.connect(mock_ws2)
        conn2.subscribe(["wifi.*"])

        message = WebSocketMessage(
            type=MessageType.HEALTH_UPDATE,
            data={"status": "ok"}
        )

        sent_count = await ws_manager.broadcast(message, topic="health.update")

        # Only conn1 should receive it
        assert sent_count == 1

    @pytest.mark.asyncio
    async def test_send_to_connection(self, ws_manager, mock_websocket):
        """Test sending message to specific connection."""
        await ws_manager.start()
        connection = await ws_manager.connect(mock_websocket)

        message = WebSocketMessage(
            type=MessageType.HEARTBEAT,
            data={"sequence": 1}
        )

        success = await ws_manager.send_to_connection(connection.connection_id, message)

        assert success is True
        assert ws_manager.messages_sent == 1

    @pytest.mark.asyncio
    async def test_send_to_nonexistent_connection(self, ws_manager):
        """Test sending to non-existent connection."""
        message = WebSocketMessage(
            type=MessageType.HEARTBEAT,
            data={"sequence": 1}
        )

        success = await ws_manager.send_to_connection("fake-id", message)

        assert success is False

    def test_get_stats(self, ws_manager):
        """Test getting WebSocket statistics."""
        stats = ws_manager.get_stats()

        assert stats.active_connections == 0
        assert stats.total_connections == 0
        assert stats.messages_sent == 0
        assert stats.messages_received == 0
        assert stats.uptime >= 0

    @pytest.mark.asyncio
    async def test_event_bus_integration(self, event_bus):
        """Test event bus integration for broadcasting."""
        ws_manager = WebSocketManager(event_bus)
        await ws_manager.start()

        # Create connection subscribed to health events
        mock_ws = AsyncMock(spec=WebSocket, client=MagicMock(host="127.0.0.1"), query_params={})
        connection = await ws_manager.connect(mock_ws)
        connection.subscribe(["health.*"])

        # Give event listener time to start
        await asyncio.sleep(0.1)

        # Emit event through event bus
        await event_bus.emit("health.update", {"status": "ok"})

        # Give time for event to propagate
        await asyncio.sleep(0.1)

        # Connection should have received the broadcast
        # (We can't easily verify the exact message, but call count should increase)
        assert mock_ws.send_json.call_count >= 1

        await ws_manager.stop()

    @pytest.mark.asyncio
    async def test_handle_invalid_json(self, ws_manager, mock_websocket):
        """Test handling invalid JSON message."""
        await ws_manager.start()
        connection = await ws_manager.connect(mock_websocket)

        # Send invalid JSON
        await ws_manager.handle_message(connection, "not valid json{")

        # Should send error message
        assert mock_websocket.send_json.call_count >= 1
        # Check that error was sent
        error_sent = False
        for call in mock_websocket.send_json.call_args_list:
            if call[0][0].get("type") == MessageType.ERROR:
                error_sent = True
                break
        assert error_sent

    @pytest.mark.asyncio
    async def test_multiple_subscriptions(self, ws_manager, mock_websocket):
        """Test handling multiple subscription requests."""
        await ws_manager.start()
        connection = await ws_manager.connect(mock_websocket)

        # First subscription
        msg1 = WebSocketMessage(
            type=MessageType.SUBSCRIBE,
            data=SubscribeMessage(topics=["health.*"]).model_dump()
        )
        await ws_manager.handle_message(connection, msg1.model_dump_json())

        # Second subscription
        msg2 = WebSocketMessage(
            type=MessageType.SUBSCRIBE,
            data=SubscribeMessage(topics=["wifi.*"]).model_dump()
        )
        await ws_manager.handle_message(connection, msg2.model_dump_json())

        assert "health.*" in connection.subscriptions
        assert "wifi.*" in connection.subscriptions

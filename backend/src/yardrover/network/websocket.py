"""WebSocket connection manager.

This module manages WebSocket connections, message routing, and event broadcasting.
Integrates with the EventBus for system-wide event distribution.
"""

import asyncio
import json
import time
import uuid
from datetime import datetime
from typing import Any, Dict, Optional, Set

import structlog
from fastapi import WebSocket, WebSocketDisconnect

from yardrover.core.events import EventBus
from yardrover.models.websocket import (
    ConnectionInfo,
    ErrorMessage,
    HeartbeatMessage,
    MessageType,
    SubscribeMessage,
    UnsubscribeMessage,
    WebSocketMessage,
    WebSocketStats,
)

logger = structlog.get_logger(__name__)


class WebSocketConnection:
    """Represents a single WebSocket client connection."""

    def __init__(
        self,
        websocket: WebSocket,
        connection_id: str,
        remote_address: str,
    ):
        """Initialize WebSocket connection.

        Args:
            websocket: FastAPI WebSocket instance
            connection_id: Unique connection identifier
            remote_address: Client IP address
        """
        self.websocket = websocket
        self.connection_id = connection_id
        self.remote_address = remote_address
        self.connected_at = datetime.utcnow()
        self.subscriptions: Set[str] = set()
        self.last_heartbeat = time.time()
        self.message_count = 0

    @property
    def info(self) -> ConnectionInfo:
        """Get connection information."""
        return ConnectionInfo(
            connection_id=self.connection_id,
            connected_at=self.connected_at,
            remote_address=self.remote_address,
            subscriptions=list(self.subscriptions),
        )

    async def send_message(self, message: WebSocketMessage) -> None:
        """Send a message to the client.

        Args:
            message: WebSocket message to send

        Raises:
            WebSocketDisconnect: If connection is closed
        """
        try:
            await self.websocket.send_json(message.model_dump(mode="json"))
            self.message_count += 1
        except Exception as e:
            logger.error(
                "websocket_send_failed",
                connection_id=self.connection_id,
                error=str(e),
            )
            raise

    async def send_error(self, code: str, message: str, details: Optional[Dict[str, Any]] = None) -> None:
        """Send an error message to the client.

        Args:
            code: Error code
            message: Error message
            details: Optional error details
        """
        error_msg = WebSocketMessage(
            type=MessageType.ERROR,
            data=ErrorMessage(
                code=code,
                message=message,
                details=details,
            ).model_dump(),
        )
        await self.send_message(error_msg)

    def subscribe(self, topics: list[str]) -> None:
        """Subscribe to event topics.

        Args:
            topics: List of topic patterns (supports wildcards)
        """
        self.subscriptions.update(topics)
        logger.info(
            "websocket_subscribed",
            connection_id=self.connection_id,
            topics=topics,
            total_subscriptions=len(self.subscriptions),
        )

    def unsubscribe(self, topics: list[str]) -> None:
        """Unsubscribe from event topics.

        Args:
            topics: List of topic patterns to remove
        """
        self.subscriptions.difference_update(topics)
        logger.info(
            "websocket_unsubscribed",
            connection_id=self.connection_id,
            topics=topics,
            total_subscriptions=len(self.subscriptions),
        )

    def is_subscribed_to(self, topic: str) -> bool:
        """Check if connection is subscribed to a topic.

        Supports wildcard matching:
        - "health.*" matches "health.update", "health.error", etc.
        - "*" matches all topics

        Args:
            topic: Topic to check

        Returns:
            True if subscribed to the topic
        """
        for pattern in self.subscriptions:
            if pattern == "*":
                return True
            if pattern.endswith(".*"):
                prefix = pattern[:-2]
                if topic.startswith(prefix + "."):
                    return True
            elif pattern == topic:
                return True
        return False


class WebSocketManager:
    """Manages WebSocket connections and message broadcasting."""

    def __init__(self, event_bus: Optional[EventBus] = None):
        """Initialize WebSocket manager.

        Args:
            event_bus: Optional event bus for system event integration
        """
        self.event_bus = event_bus
        self.connections: Dict[str, WebSocketConnection] = {}
        self.total_connections = 0
        self.messages_sent = 0
        self.messages_received = 0
        self.start_time = time.time()
        self._heartbeat_task: Optional[asyncio.Task] = None
        self._event_listener_task: Optional[asyncio.Task] = None
        self._running = False

        logger.info("websocket_manager_initialized")

    async def start(self) -> None:
        """Start the WebSocket manager."""
        if self._running:
            return

        self._running = True

        # Start heartbeat task
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())

        # Start event listener if event bus is available
        if self.event_bus:
            self._event_listener_task = asyncio.create_task(self._event_listener())

        logger.info("websocket_manager_started")

    async def stop(self) -> None:
        """Stop the WebSocket manager and close all connections."""
        self._running = False

        # Cancel background tasks
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
            try:
                await self._heartbeat_task
            except asyncio.CancelledError:
                pass

        if self._event_listener_task:
            self._event_listener_task.cancel()
            try:
                await self._event_listener_task
            except asyncio.CancelledError:
                pass

        # Close all connections
        for conn in list(self.connections.values()):
            try:
                await conn.websocket.close()
            except Exception as e:
                logger.error(
                    "websocket_close_error",
                    connection_id=conn.connection_id,
                    error=str(e),
                )

        self.connections.clear()
        logger.info("websocket_manager_stopped")

    async def connect(self, websocket: WebSocket) -> WebSocketConnection:
        """Accept a new WebSocket connection.

        Args:
            websocket: FastAPI WebSocket instance

        Returns:
            WebSocketConnection instance
        """
        await websocket.accept()

        connection_id = str(uuid.uuid4())
        remote_address = websocket.client.host if websocket.client else "unknown"

        connection = WebSocketConnection(websocket, connection_id, remote_address)
        self.connections[connection_id] = connection
        self.total_connections += 1

        logger.info(
            "websocket_connected",
            connection_id=connection_id,
            remote_address=remote_address,
            active_connections=len(self.connections),
        )

        # Emit connection event
        if self.event_bus:
            await self.event_bus.emit("websocket.connected", {"connection_id": connection_id})

        return connection

    async def disconnect(self, connection_id: str) -> None:
        """Disconnect a WebSocket client.

        Args:
            connection_id: Connection identifier
        """
        connection = self.connections.pop(connection_id, None)
        if connection:
            logger.info(
                "websocket_disconnected",
                connection_id=connection_id,
                active_connections=len(self.connections),
            )

            # Emit disconnection event
            if self.event_bus:
                await self.event_bus.emit("websocket.disconnected", {"connection_id": connection_id})

    async def handle_message(self, connection: WebSocketConnection, data: str) -> None:
        """Handle incoming WebSocket message.

        Args:
            connection: WebSocket connection
            data: Raw message data (JSON string)
        """
        self.messages_received += 1

        try:
            # Parse message
            message_dict = json.loads(data)
            message = WebSocketMessage(**message_dict)

            logger.debug(
                "websocket_message_received",
                connection_id=connection.connection_id,
                type=message.type,
            )

            # Handle different message types
            if message.type == MessageType.SUBSCRIBE:
                await self._handle_subscribe(connection, message)
            elif message.type == MessageType.UNSUBSCRIBE:
                await self._handle_unsubscribe(connection, message)
            elif message.type == MessageType.PING:
                await self._handle_ping(connection, message)
            else:
                logger.warning(
                    "websocket_unknown_message_type",
                    connection_id=connection.connection_id,
                    type=message.type,
                )

        except json.JSONDecodeError as e:
            await connection.send_error("INVALID_JSON", f"Invalid JSON: {str(e)}")
        except Exception as e:
            logger.error(
                "websocket_message_handler_error",
                connection_id=connection.connection_id,
                error=str(e),
            )
            await connection.send_error("INTERNAL_ERROR", "Failed to process message")

    async def broadcast(self, message: WebSocketMessage, topic: Optional[str] = None) -> int:
        """Broadcast a message to all subscribed connections.

        Args:
            message: Message to broadcast
            topic: Optional topic for subscription filtering

        Returns:
            Number of connections the message was sent to
        """
        sent_count = 0

        for connection in list(self.connections.values()):
            # Check subscription if topic is specified
            if topic and not connection.is_subscribed_to(topic):
                continue

            try:
                await connection.send_message(message)
                sent_count += 1
            except WebSocketDisconnect:
                await self.disconnect(connection.connection_id)
            except Exception as e:
                logger.error(
                    "websocket_broadcast_error",
                    connection_id=connection.connection_id,
                    error=str(e),
                )

        self.messages_sent += sent_count
        return sent_count

    async def send_to_connection(self, connection_id: str, message: WebSocketMessage) -> bool:
        """Send a message to a specific connection.

        Args:
            connection_id: Target connection ID
            message: Message to send

        Returns:
            True if sent successfully, False if connection not found
        """
        connection = self.connections.get(connection_id)
        if not connection:
            return False

        try:
            await connection.send_message(message)
            self.messages_sent += 1
            return True
        except WebSocketDisconnect:
            await self.disconnect(connection_id)
            return False
        except Exception as e:
            logger.error(
                "websocket_send_error",
                connection_id=connection_id,
                error=str(e),
            )
            return False

    def get_stats(self) -> WebSocketStats:
        """Get WebSocket server statistics.

        Returns:
            WebSocketStats with current statistics
        """
        return WebSocketStats(
            active_connections=len(self.connections),
            total_connections=self.total_connections,
            messages_sent=self.messages_sent,
            messages_received=self.messages_received,
            uptime=time.time() - self.start_time,
        )

    async def _handle_subscribe(self, connection: WebSocketConnection, message: WebSocketMessage) -> None:
        """Handle subscription request.

        Args:
            connection: WebSocket connection
            message: Subscribe message
        """
        try:
            subscribe_data = SubscribeMessage(**(message.data or {}))
            connection.subscribe(subscribe_data.topics)

            # Send acknowledgment
            response = WebSocketMessage(
                type=MessageType.SUBSCRIBE,
                data={"subscribed": subscribe_data.topics},
            )
            await connection.send_message(response)

        except Exception as e:
            await connection.send_error(
                "SUBSCRIBE_FAILED",
                f"Subscription failed: {str(e)}",
            )

    async def _handle_unsubscribe(self, connection: WebSocketConnection, message: WebSocketMessage) -> None:
        """Handle unsubscription request.

        Args:
            connection: WebSocket connection
            message: Unsubscribe message
        """
        try:
            unsubscribe_data = UnsubscribeMessage(**(message.data or {}))
            connection.unsubscribe(unsubscribe_data.topics)

            # Send acknowledgment
            response = WebSocketMessage(
                type=MessageType.UNSUBSCRIBE,
                data={"unsubscribed": unsubscribe_data.topics},
            )
            await connection.send_message(response)

        except Exception as e:
            await connection.send_error(
                "UNSUBSCRIBE_FAILED",
                f"Unsubscription failed: {str(e)}",
            )

    async def _handle_ping(self, connection: WebSocketConnection, message: WebSocketMessage) -> None:
        """Handle ping request.

        Args:
            connection: WebSocket connection
            message: Ping message
        """
        response = WebSocketMessage(
            type=MessageType.PONG,
            data=message.data,  # Echo back the ping data
        )
        await connection.send_message(response)

    async def _heartbeat_loop(self) -> None:
        """Send periodic heartbeats to all connections."""
        sequence = 0

        while self._running:
            try:
                await asyncio.sleep(30)  # Send heartbeat every 30 seconds

                uptime = time.time() - self.start_time
                heartbeat = WebSocketMessage(
                    type=MessageType.HEARTBEAT,
                    data=HeartbeatMessage(
                        sequence=sequence,
                        uptime=uptime,
                    ).model_dump(),
                )

                await self.broadcast(heartbeat)
                sequence += 1

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("websocket_heartbeat_error", error=str(e))

    async def _event_listener(self) -> None:
        """Listen for system events and broadcast to WebSocket clients."""
        if not self.event_bus:
            return

        async def event_handler(event_name: str, data: Any) -> None:
            """Handle system events and broadcast to subscribers."""
            # Map event names to message types
            message_type_map = {
                "health.update": MessageType.HEALTH_UPDATE,
                "config.changed": MessageType.CONFIG_CHANGED,
                "wifi.status.changed": MessageType.WIFI_STATUS_CHANGED,
                "wifi.scan.result": MessageType.WIFI_SCAN_RESULT,
                "wifi.connected": MessageType.WIFI_CONNECTED,
                "wifi.disconnected": MessageType.WIFI_DISCONNECTED,
                "wifi.signal.update": MessageType.WIFI_SIGNAL_UPDATE,
                "mdns.service.discovered": MessageType.MDNS_SERVICE_DISCOVERED,
                "mavlink.message": MessageType.MAVLINK_MESSAGE,
                "mavlink.heartbeat": MessageType.MAVLINK_HEARTBEAT,
                "telemetry.update": MessageType.TELEMETRY_UPDATE,
                "zone.created": MessageType.ZONE_CREATED,
                "zone.updated": MessageType.ZONE_UPDATED,
                "zone.deleted": MessageType.ZONE_DELETED,
                "mission.created": MessageType.MISSION_CREATED,
                "mission.updated": MessageType.MISSION_UPDATED,
                "mission.deleted": MessageType.MISSION_DELETED,
                "rtcm.status.changed": MessageType.RTCM_STATUS_CHANGED,
                "rtcm.data": MessageType.RTCM_DATA,
            }

            message_type = message_type_map.get(event_name)
            if message_type:
                ws_message = WebSocketMessage(
                    type=message_type,
                    data=data if isinstance(data, dict) else {"value": data},
                )
                await self.broadcast(ws_message, topic=event_name)

        # Subscribe to all events
        await self.event_bus.subscribe("*", event_handler)

        try:
            # Keep the listener running
            while self._running:
                await asyncio.sleep(1)
        except asyncio.CancelledError:
            pass
        finally:
            # Unsubscribe when stopping
            await self.event_bus.unsubscribe("*", event_handler)

"""WebSocket API endpoint.

This module provides the WebSocket endpoint for real-time communication.
"""

import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from yardrover.network.websocket import WebSocketManager

logger = structlog.get_logger(__name__)

router = APIRouter()

# WebSocket manager instance (will be set by main app)
ws_manager: WebSocketManager = None  # type: ignore


def set_websocket_manager(manager: WebSocketManager) -> None:
    """Set the WebSocket manager instance.

    Args:
        manager: WebSocket manager to use
    """
    global ws_manager
    ws_manager = manager


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """WebSocket endpoint for real-time communication.

    Supports the following message types:
    - subscribe: Subscribe to event topics
    - unsubscribe: Unsubscribe from event topics
    - ping: Connection keepalive

    Server broadcasts:
    - heartbeat: Periodic connection keepalive
    - health_update: System health changes
    - config_changed: Configuration updates
    - wifi_status_changed: WiFi status changes
    - mavlink_message: MAVLink messages
    - telemetry_update: Telemetry data
    - zone_created/updated/deleted: Zone changes
    - mission_created/updated/deleted: Mission changes
    - And more (see MessageType enum)

    Args:
        websocket: FastAPI WebSocket connection
    """
    if not ws_manager:
        logger.error("websocket_manager_not_initialized")
        await websocket.close(code=1011, reason="Server not ready")
        return

    connection = await ws_manager.connect(websocket)

    try:
        # Handle incoming messages
        while True:
            data = await websocket.receive_text()
            await ws_manager.handle_message(connection, data)

    except WebSocketDisconnect:
        logger.info(
            "websocket_client_disconnected",
            connection_id=connection.connection_id,
        )
    except Exception as e:
        logger.error(
            "websocket_error",
            connection_id=connection.connection_id,
            error=str(e),
        )
    finally:
        await ws_manager.disconnect(connection.connection_id)


@router.get("/ws/stats")
async def get_websocket_stats() -> dict:
    """Get WebSocket server statistics.

    Returns:
        WebSocket statistics including active connections and message counts
    """
    if not ws_manager:
        return {
            "error": "WebSocket manager not initialized",
            "active_connections": 0,
        }

    stats = ws_manager.get_stats()
    return stats.model_dump()


@router.get("/ws/connections")
async def get_active_connections() -> dict:
    """Get information about active WebSocket connections.

    Returns:
        List of active connection details
    """
    if not ws_manager:
        return {
            "connections": [],
            "count": 0,
        }

    connections = [
        conn.info.model_dump()
        for conn in ws_manager.connections.values()
    ]

    return {
        "connections": connections,
        "count": len(connections),
    }

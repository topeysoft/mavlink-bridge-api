"""WebSocket API endpoint.

This module provides the WebSocket endpoint for real-time communication.
"""

from typing import Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect

from yardrover.auth import SecurityContext, require_viewer, verify_websocket_token
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
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
) -> None:
    """WebSocket endpoint for real-time communication.

    **Authentication Required**: Pass JWT token as query parameter: `/ws?token=YOUR_JWT_TOKEN`

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
        token: JWT authentication token (query parameter)
    """
    # Verify authentication before accepting connection
    if not token:
        logger.warning("websocket_connection_rejected", reason="no_token")
        await websocket.close(code=1008, reason="Authentication required")
        return

    try:
        # Verify JWT token
        context = await verify_websocket_token(token)
    except HTTPException as e:
        logger.warning(
            "websocket_auth_failed",
            reason=e.detail,
        )
        await websocket.close(code=1008, reason="Authentication failed")
        return

    if not ws_manager:
        logger.error("websocket_manager_not_initialized")
        await websocket.close(code=1011, reason="Server not ready")
        return

    # Accept connection with authenticated context
    connection = await ws_manager.connect(websocket, context)

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
async def get_websocket_stats(
    context: SecurityContext = Depends(require_viewer),
) -> dict:
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
async def get_active_connections(
    context: SecurityContext = Depends(require_viewer),
) -> dict:
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

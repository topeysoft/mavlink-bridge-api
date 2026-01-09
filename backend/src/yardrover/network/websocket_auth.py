"""WebSocket authentication and security utilities.

This module provides authentication and rate limiting for WebSocket connections.
"""

import time
from collections import defaultdict
from typing import Dict, Optional

import structlog
from fastapi import WebSocket, status

logger = structlog.get_logger(__name__)


class RateLimiter:
    """Simple rate limiter for WebSocket connections."""

    def __init__(self, max_messages: int = 100, window_seconds: int = 60):
        """Initialize rate limiter.

        Args:
            max_messages: Maximum messages per window
            window_seconds: Time window in seconds
        """
        self.max_messages = max_messages
        self.window_seconds = window_seconds
        self._message_counts: Dict[str, list[float]] = defaultdict(list)

    def check_rate_limit(self, connection_id: str) -> bool:
        """Check if connection is within rate limit.

        Args:
            connection_id: Connection identifier

        Returns:
            True if within limit, False if rate limit exceeded
        """
        now = time.time()
        window_start = now - self.window_seconds

        # Clean up old timestamps
        self._message_counts[connection_id] = [
            ts for ts in self._message_counts[connection_id]
            if ts > window_start
        ]

        # Check limit
        if len(self._message_counts[connection_id]) >= self.max_messages:
            logger.warning(
                "rate_limit_exceeded",
                connection_id=connection_id,
                count=len(self._message_counts[connection_id]),
                max=self.max_messages,
                window=self.window_seconds,
            )
            return False

        # Record this message
        self._message_counts[connection_id].append(now)
        return True

    def reset(self, connection_id: str) -> None:
        """Reset rate limit for a connection.

        Args:
            connection_id: Connection identifier
        """
        self._message_counts.pop(connection_id, None)

    def cleanup_old_entries(self) -> None:
        """Clean up old rate limit entries (call periodically)."""
        now = time.time()
        window_start = now - self.window_seconds

        # Remove connections with no recent activity
        inactive = [
            conn_id
            for conn_id, timestamps in self._message_counts.items()
            if not timestamps or max(timestamps) < window_start
        ]

        for conn_id in inactive:
            del self._message_counts[conn_id]


class WebSocketAuthenticator:
    """WebSocket authentication handler."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        allow_anonymous: bool = True,
    ):
        """Initialize WebSocket authenticator.

        Args:
            api_key: Optional API key for authentication
            allow_anonymous: Whether to allow anonymous connections
        """
        self.api_key = api_key
        self.allow_anonymous = allow_anonymous

    async def authenticate(self, websocket: WebSocket) -> bool:
        """Authenticate a WebSocket connection.

        Checks query parameters for authentication credentials:
        - ?api_key=<key>: API key authentication
        - No params: Anonymous if allowed

        Args:
            websocket: WebSocket connection

        Returns:
            True if authenticated, False otherwise
        """
        # Check for API key in query parameters
        query_params = dict(websocket.query_params)
        provided_key = query_params.get("api_key")

        # If API key is configured, require it
        if self.api_key:
            if provided_key != self.api_key:
                logger.warning(
                    "websocket_auth_failed",
                    remote_address=websocket.client.host if websocket.client else "unknown",
                    reason="invalid_api_key",
                )
                await websocket.close(
                    code=status.WS_1008_POLICY_VIOLATION,
                    reason="Authentication failed",
                )
                return False

        # If no API key configured, check anonymous access
        elif not self.allow_anonymous:
            logger.warning(
                "websocket_auth_failed",
                remote_address=websocket.client.host if websocket.client else "unknown",
                reason="anonymous_not_allowed",
            )
            await websocket.close(
                code=status.WS_1008_POLICY_VIOLATION,
                reason="Anonymous access not allowed",
            )
            return False

        return True


class ConnectionLimiter:
    """Limits the number of concurrent WebSocket connections."""

    def __init__(self, max_connections: int = 100):
        """Initialize connection limiter.

        Args:
            max_connections: Maximum concurrent connections
        """
        self.max_connections = max_connections
        self._connection_count = 0

    def can_connect(self) -> bool:
        """Check if a new connection can be accepted.

        Returns:
            True if connection can be accepted, False if limit reached
        """
        return self._connection_count < self.max_connections

    def on_connect(self) -> bool:
        """Handle new connection attempt.

        Returns:
            True if connection accepted, False if limit reached
        """
        if self._connection_count >= self.max_connections:
            logger.warning(
                "connection_limit_reached",
                current=self._connection_count,
                max=self.max_connections,
            )
            return False

        self._connection_count += 1
        return True

    def on_disconnect(self) -> None:
        """Handle connection disconnect."""
        if self._connection_count > 0:
            self._connection_count -= 1


# Global rate limiter instance
_rate_limiter: Optional[RateLimiter] = None


def get_rate_limiter() -> RateLimiter:
    """Get global rate limiter instance.

    Returns:
        RateLimiter instance
    """
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = RateLimiter(max_messages=100, window_seconds=60)
    return _rate_limiter


# Global connection limiter instance
_connection_limiter: Optional[ConnectionLimiter] = None


def get_connection_limiter() -> ConnectionLimiter:
    """Get global connection limiter instance.

    Returns:
        ConnectionLimiter instance
    """
    global _connection_limiter
    if _connection_limiter is None:
        _connection_limiter = ConnectionLimiter(max_connections=100)
    return _connection_limiter

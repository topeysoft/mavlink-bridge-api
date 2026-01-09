"""Custom exception hierarchy for YardRover."""

from typing import Any, Optional


class YardRoverError(Exception):
    """Base exception for all YardRover errors.

    All custom exceptions should inherit from this class.
    """

    # HTTP status code for this error (can be overridden in subclasses)
    http_status: int = 500

    def __init__(
        self,
        message: str,
        code: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        """Initialize error with message, code, and optional details.

        Args:
            message: Human-readable error message
            code: Machine-readable error code
            details: Additional error context
        """
        super().__init__(message)
        self.message = message
        self.code = code or self.__class__.__name__
        self.details = details or {}

    def to_dict(self) -> dict[str, Any]:
        """Convert error to dictionary for API responses.

        Returns:
            Dictionary representation of the error
        """
        return {
            "error": self.__class__.__name__,
            "message": self.message,
            "code": self.code,
            "details": self.details,
        }


# Configuration Errors
class ConfigurationError(YardRoverError):
    """Configuration-related errors."""
    pass


class ConfigNotFoundError(ConfigurationError):
    """Configuration file not found."""
    pass


class ConfigValidationError(ConfigurationError):
    """Configuration validation failed."""
    pass


# Storage Errors
class StorageError(YardRoverError):
    """Storage operation errors."""
    pass


class StorageNotFoundError(StorageError):
    """Requested resource not found in storage."""
    http_status = 404


class StoragePermissionError(StorageError):
    """Permission denied for storage operation."""
    http_status = 403


class StorageFullError(StorageError):
    """Storage is full or quota exceeded."""
    http_status = 507  # Insufficient Storage


# MAVLink Errors
class MAVLinkError(YardRoverError):
    """MAVLink communication errors."""
    pass


class MAVLinkTimeoutError(MAVLinkError):
    """MAVLink operation timed out."""
    pass


class MAVLinkParseError(MAVLinkError):
    """Failed to parse MAVLink message."""
    pass


class MAVLinkConnectionError(MAVLinkError):
    """MAVLink connection error."""
    pass


# Network Errors
class NetworkError(YardRoverError):
    """Network operation errors."""
    pass


class WiFiConnectionError(NetworkError):
    """WiFi connection failed."""
    pass


class WiFiScanError(NetworkError):
    """WiFi scan operation failed."""
    pass


class MDNSError(NetworkError):
    """mDNS operation error."""
    pass


# Resource Errors
class ResourceError(YardRoverError):
    """Resource management errors."""
    pass


class ResourceNotFoundError(ResourceError):
    """Resource not found."""
    http_status = 404


class ResourceValidationError(ResourceError):
    """Resource validation failed."""
    http_status = 400


class ResourceConflictError(ResourceError):
    """Resource conflict (duplicate ID, etc.)."""
    http_status = 409


# RTCM Errors
class RTCMError(YardRoverError):
    """RTCM-related errors."""
    pass


class NTRIPConnectionError(RTCMError):
    """NTRIP connection failed."""
    pass


class RTCMParseError(RTCMError):
    """Failed to parse RTCM message."""
    pass


# Serial Communication Errors
class SerialError(YardRoverError):
    """Serial communication errors."""
    pass


class SerialPortError(SerialError):
    """Serial port error."""
    pass


class SerialTimeoutError(SerialError):
    """Serial operation timed out."""
    pass


# Event System Errors
class EventError(YardRoverError):
    """Event system errors."""
    pass


class EventSubscriptionError(EventError):
    """Event subscription failed."""
    pass

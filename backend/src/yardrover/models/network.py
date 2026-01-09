"""
Network-related Pydantic models for WiFi and mDNS.

This module defines data models for:
- WiFi network information
- WiFi connection credentials and status
- mDNS service advertisement and discovery
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# ============================================================================
# WiFi Models
# ============================================================================


class WiFiAuthMode(str, Enum):
    """WiFi authentication modes."""

    OPEN = "open"
    WEP = "wep"
    WPA_PSK = "wpa_psk"
    WPA2_PSK = "wpa2_psk"
    WPA_WPA2_PSK = "wpa_wpa2_psk"
    WPA2_ENTERPRISE = "wpa2_enterprise"
    WPA3_PSK = "wpa3_psk"
    WPA2_WPA3_PSK = "wpa2_wpa3_psk"


class WiFiState(str, Enum):
    """WiFi connection states."""

    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    AP_MODE = "ap_mode"
    ERROR = "error"


class WiFiNetwork(BaseModel):
    """WiFi network scan result."""

    ssid: str = Field(..., description="Network SSID")
    rssi: int = Field(..., description="Signal strength in dBm", ge=-127, le=0)
    auth_mode: WiFiAuthMode = Field(..., description="Authentication mode")
    channel: int = Field(..., description="WiFi channel", ge=1, le=14)
    bssid: Optional[str] = Field(None, description="MAC address of access point")

    @field_validator("ssid")
    @classmethod
    def validate_ssid(cls, v: str) -> str:
        """Validate SSID is not empty."""
        if not v or not v.strip():
            raise ValueError("SSID cannot be empty")
        return v.strip()


class WiFiCredentials(BaseModel):
    """WiFi connection credentials."""

    ssid: str = Field(..., description="Network SSID", min_length=1, max_length=32)
    password: Optional[str] = Field(
        None, description="Network password", max_length=64
    )

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: Optional[str], info) -> Optional[str]:
        """Validate password based on auth mode."""
        if v is not None and len(v) > 0 and len(v) < 8:
            raise ValueError("Password must be at least 8 characters if provided")
        return v


class WiFiConnectionInfo(BaseModel):
    """Current WiFi connection information."""

    ssid: str = Field(..., description="Connected network SSID")
    bssid: str = Field(..., description="Access point MAC address")
    rssi: int = Field(..., description="Signal strength in dBm", ge=-127, le=0)
    ip_address: str = Field(..., description="Assigned IP address")
    gateway: str = Field(..., description="Gateway IP address")
    subnet_mask: str = Field(..., description="Subnet mask")
    channel: Optional[int] = Field(None, description="WiFi channel")


class WiFiStatus(BaseModel):
    """WiFi connection status."""

    state: WiFiState = Field(..., description="Current WiFi state")
    connection_info: Optional[WiFiConnectionInfo] = Field(
        None, description="Connection details if connected"
    )
    saved_network: Optional[str] = Field(
        None, description="Saved network SSID for auto-connect"
    )
    ap_mode_active: bool = Field(
        False, description="Whether access point mode is active"
    )
    ap_ssid: Optional[str] = Field(None, description="Access point SSID if active")
    ap_ip: Optional[str] = Field(None, description="Access point IP address if active")


class WiFiConnectResponse(BaseModel):
    """Response from WiFi connect operation."""

    success: bool = Field(..., description="Whether connection was initiated")
    message: str = Field(..., description="Status message")
    state: WiFiState = Field(..., description="Current WiFi state")


class WiFiScanResponse(BaseModel):
    """Response from WiFi scan operation."""

    networks: list[WiFiNetwork] = Field(..., description="Discovered WiFi networks")
    scan_time: datetime = Field(
        default_factory=datetime.utcnow, description="Time of scan"
    )


# ============================================================================
# mDNS Models
# ============================================================================


class MDNSService(BaseModel):
    """mDNS service advertisement."""

    service_name: str = Field(..., description="Service instance name")
    service_type: str = Field(..., description="Service type (e.g., '_http._tcp')")
    port: int = Field(..., description="Service port", ge=1, le=65535)
    hostname: Optional[str] = Field(None, description="Hostname")
    txt_records: dict[str, str] = Field(
        default_factory=dict, description="TXT record key-value pairs"
    )

    @field_validator("service_type")
    @classmethod
    def validate_service_type(cls, v: str) -> str:
        """Validate service type format."""
        if not v.startswith("_") or not ("._tcp" in v or "._udp" in v):
            raise ValueError(
                "Service type must start with '_' and contain '._tcp' or '._udp'"
            )
        return v


class DiscoveredService(BaseModel):
    """Discovered mDNS service."""

    hostname: str = Field(..., description="Service hostname")
    service_name: str = Field(..., description="Service instance name")
    service_type: str = Field(..., description="Service type")
    ip_address: str = Field(..., description="Service IP address")
    port: int = Field(..., description="Service port", ge=1, le=65535)
    txt_records: dict[str, str] = Field(
        default_factory=dict, description="TXT record key-value pairs"
    )
    last_seen: datetime = Field(
        default_factory=datetime.utcnow, description="Last discovery time"
    )


class MDNSConfig(BaseModel):
    """mDNS configuration."""

    enabled: bool = Field(True, description="Whether mDNS is enabled")
    hostname: str = Field(..., description="Device hostname", min_length=1)

    @field_validator("hostname")
    @classmethod
    def validate_hostname(cls, v: str) -> str:
        """Validate hostname format."""
        # Basic hostname validation (alphanumeric and hyphens, no spaces)
        if not v.replace("-", "").replace("_", "").isalnum():
            raise ValueError(
                "Hostname must contain only alphanumeric characters, hyphens, and underscores"
            )
        return v.lower()


class MDNSStatus(BaseModel):
    """mDNS service status."""

    enabled: bool = Field(..., description="Whether mDNS is enabled")
    hostname: str = Field(..., description="Current hostname")
    advertised_services: list[MDNSService] = Field(
        default_factory=list, description="Services being advertised"
    )
    discovered_services: list[DiscoveredService] = Field(
        default_factory=list, description="Services discovered on network"
    )


class MDNSDiscoverRequest(BaseModel):
    """Request to discover mDNS services."""

    service_type: str = Field(
        "_rtk-base._tcp", description="Service type to discover"
    )
    timeout: int = Field(
        5, description="Discovery timeout in seconds", ge=1, le=30
    )


class MDNSDiscoverResponse(BaseModel):
    """Response from mDNS discovery operation."""

    service_type: str = Field(..., description="Service type discovered")
    services: list[DiscoveredService] = Field(..., description="Discovered services")
    discovery_time: datetime = Field(
        default_factory=datetime.utcnow, description="Time of discovery"
    )

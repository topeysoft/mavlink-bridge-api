"""Pydantic models for configuration management."""

from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


# Configuration Models (for config.yaml structure)
class DeviceConfig(BaseModel):
    """Device configuration."""

    name: str = Field(default="YardRover", min_length=1, max_length=128)
    hostname: str = Field(default="yardrover-pi", min_length=1, max_length=64)

    @field_validator("hostname")
    @classmethod
    def validate_hostname(cls, v: str) -> str:
        """Validate hostname format."""
        if not v.replace("-", "").replace("_", "").isalnum():
            raise ValueError("Hostname must contain only alphanumeric, hyphen, underscore")
        return v.lower()


class WiFiConfig(BaseModel):
    """WiFi configuration."""

    auto_connect: bool = Field(default=True)
    ssid: Optional[str] = Field(default=None, max_length=32)
    password: Optional[str] = Field(default=None, max_length=64)


class AccessPointConfig(BaseModel):
    """Access Point configuration."""

    enabled: bool = Field(default=True)
    ssid: str = Field(default="YardRover-Setup", min_length=1, max_length=32)
    password: str = Field(default="yardrover123", min_length=8, max_length=64)


class MDNSConfig(BaseModel):
    """mDNS configuration."""

    enabled: bool = Field(default=True)
    hostname: Optional[str] = Field(default=None, max_length=64)


class NetworkConfig(BaseModel):
    """Network configuration."""

    wifi: WiFiConfig = Field(default_factory=WiFiConfig)
    ap: AccessPointConfig = Field(default_factory=AccessPointConfig)
    mdns: MDNSConfig = Field(default_factory=MDNSConfig)


class SerialConfig(BaseModel):
    """Serial communication configuration."""

    port: str = Field(default="/dev/ttyS0")
    baudrate: int = Field(default=57600, ge=9600, le=115200)
    timeout: float = Field(default=1.0, ge=0.1, le=10.0)


class StorageConfig(BaseModel):
    """Storage configuration."""

    base_path: Path = Field(default=Path("/var/lib/yardrover"))
    resources_path: Optional[Path] = None

    @field_validator("base_path", "resources_path")
    @classmethod
    def expand_path(cls, v: Optional[Path]) -> Optional[Path]:
        """Expand and resolve path."""
        if v is None:
            return None
        return v.expanduser().resolve()


class NTRIPConfig(BaseModel):
    """NTRIP configuration for RTCM."""

    host: Optional[str] = Field(default=None, max_length=256)
    port: int = Field(default=2101, ge=1, le=65535)
    mountpoint: Optional[str] = Field(default=None, max_length=128)
    username: Optional[str] = Field(default=None, max_length=128)
    password: Optional[str] = Field(default=None, max_length=128)


class RTCMConfig(BaseModel):
    """RTCM configuration."""

    enabled: bool = Field(default=False)
    source: NTRIPConfig = Field(default_factory=NTRIPConfig)


class SecurityConfig(BaseModel):
    """Security and authentication configuration."""

    enabled: bool = Field(default=True, description="Enable authentication")
    jwt_secret: Optional[str] = Field(default=None, description="JWT secret key")
    jwt_algorithm: str = Field(default="HS256", description="JWT algorithm")
    access_token_expire_minutes: int = Field(
        default=60 * 24 * 30,  # 30 days
        description="Access token expiration in minutes",
    )
    api_key_header: str = Field(default="X-API-Key", description="API key header name")
    allow_anonymous_health: bool = Field(
        default=True, description="Allow unauthenticated /api/health"
    )
    allow_anonymous_docs: bool = Field(
        default=False, description="Allow unauthenticated API docs"
    )
    rate_limit_enabled: bool = Field(default=True, description="Enable rate limiting")
    rate_limit_requests: int = Field(default=100, description="Max requests per window")
    rate_limit_window_seconds: int = Field(
        default=60, description="Rate limit window in seconds"
    )
    cors_origins: list[str] = Field(
        default_factory=lambda: ["*"], description="Allowed CORS origins"
    )


class Configuration(BaseModel):
    """Complete application configuration.

    This model represents the structure of config.yaml.
    """

    device: DeviceConfig = Field(default_factory=DeviceConfig)
    network: NetworkConfig = Field(default_factory=NetworkConfig)
    serial: SerialConfig = Field(default_factory=SerialConfig)
    storage: StorageConfig = Field(default_factory=StorageConfig)
    rtcm: RTCMConfig = Field(default_factory=RTCMConfig)
    security: SecurityConfig = Field(default_factory=SecurityConfig)

    model_config = {"extra": "allow"}  # Allow extra fields for future compatibility


# Settings (for environment variable configuration)
class Settings(BaseSettings):
    """Application settings from environment variables.

    Environment variables should be prefixed with YARDROVER_
    (e.g., YARDROVER_DEVICE_NAME="YardRover Pi")
    """

    model_config = SettingsConfigDict(
        env_prefix="YARDROVER_",
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Device settings
    device_name: str = Field(default="YardRover")
    device_hostname: str = Field(default="yardrover-pi")

    # Serial settings
    serial_port: str = Field(default="/dev/ttyS0")
    serial_baudrate: int = Field(default=57600, ge=9600, le=115200)
    serial_timeout: float = Field(default=1.0, ge=0.1, le=10.0)

    # Storage settings
    storage_path: Path = Field(default=Path("/var/lib/yardrover"))
    resource_storage_path: Optional[Path] = None

    # Network settings
    wifi_auto_connect: bool = Field(default=True)
    ap_mode_enabled: bool = Field(default=True)
    mdns_enabled: bool = Field(default=True)

    # RTCM settings
    rtcm_enabled: bool = Field(default=False)
    ntrip_host: Optional[str] = None
    ntrip_port: int = Field(default=2101)
    ntrip_mountpoint: Optional[str] = None
    ntrip_username: Optional[str] = None
    ntrip_password: Optional[str] = None

    # Server settings
    host: str = Field(default="0.0.0.0")
    port: int = Field(default=8000, ge=1, le=65535)
    workers: int = Field(default=2, ge=1, le=16)

    # Logging settings
    log_level: str = Field(default="INFO")
    log_format: str = Field(default="json")

    # Development settings
    debug: bool = Field(default=False)
    reload: bool = Field(default=False)

    # Security settings
    security_enabled: bool = Field(default=True)
    jwt_secret: Optional[str] = Field(default=None)
    jwt_algorithm: str = Field(default="HS256")
    access_token_expire_minutes: int = Field(default=60 * 24 * 30)  # 30 days
    api_key_header: str = Field(default="X-API-Key")
    allow_anonymous_health: bool = Field(default=True)
    allow_anonymous_docs: bool = Field(default=False)
    rate_limit_enabled: bool = Field(default=True)
    rate_limit_requests: int = Field(default=100)
    rate_limit_window_seconds: int = Field(default=60)
    cors_origins: list[str] = Field(default_factory=lambda: ["*"])

    @field_validator("storage_path", "resource_storage_path")
    @classmethod
    def expand_path(cls, v: Optional[Path]) -> Optional[Path]:
        """Expand path, keeping relative paths as-is for development."""
        if v is None:
            return None
        # Expand ~ but don't resolve() relative paths (keeps ./dev-storage relative)
        expanded = v.expanduser()
        # Only resolve if it's an absolute path
        if expanded.is_absolute():
            return expanded.resolve()
        return expanded

    def to_configuration(self) -> Configuration:
        """Convert Settings to Configuration model.

        Returns:
            Configuration instance populated from settings
        """
        return Configuration(
            device=DeviceConfig(
                name=self.device_name,
                hostname=self.device_hostname,
            ),
            network=NetworkConfig(
                wifi=WiFiConfig(auto_connect=self.wifi_auto_connect),
                ap=AccessPointConfig(enabled=self.ap_mode_enabled),
                mdns=MDNSConfig(enabled=self.mdns_enabled),
            ),
            serial=SerialConfig(
                port=self.serial_port,
                baudrate=self.serial_baudrate,
                timeout=self.serial_timeout,
            ),
            storage=StorageConfig(
                base_path=self.storage_path,
                resources_path=self.resource_storage_path,
            ),
            rtcm=RTCMConfig(
                enabled=self.rtcm_enabled,
                source=NTRIPConfig(
                    host=self.ntrip_host,
                    port=self.ntrip_port,
                    mountpoint=self.ntrip_mountpoint,
                    username=self.ntrip_username,
                    password=self.ntrip_password,
                ),
            ),
            security=SecurityConfig(
                enabled=self.security_enabled,
                jwt_secret=self.jwt_secret,
                jwt_algorithm=self.jwt_algorithm,
                access_token_expire_minutes=self.access_token_expire_minutes,
                api_key_header=self.api_key_header,
                allow_anonymous_health=self.allow_anonymous_health,
                allow_anonymous_docs=self.allow_anonymous_docs,
                rate_limit_enabled=self.rate_limit_enabled,
                rate_limit_requests=self.rate_limit_requests,
                rate_limit_window_seconds=self.rate_limit_window_seconds,
                cors_origins=self.cors_origins,
            ),
        )

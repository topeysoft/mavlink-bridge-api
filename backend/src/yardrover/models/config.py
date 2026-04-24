"""Pydantic models for configuration management."""

from pathlib import Path
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator
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
    output_to_fc: bool = Field(
        default=True,
        description="Automatically send RTCM corrections to Flight Controller via MAVLink"
    )


class TLSConfig(BaseModel):
    """TLS/SSL configuration for HTTPS."""

    enabled: bool = Field(default=False, description="Enable HTTPS/TLS")
    cert_file: Optional[Path] = Field(default=None, description="Path to SSL certificate file")
    key_file: Optional[Path] = Field(default=None, description="Path to SSL private key file")
    ca_certs: Optional[Path] = Field(default=None, description="Path to CA certificates bundle")
    port: int = Field(default=443, ge=1, le=65535, description="HTTPS port (default 443)")

    @field_validator("cert_file", "key_file", "ca_certs")
    @classmethod
    def expand_path(cls, v: Optional[Path]) -> Optional[Path]:
        """Expand and resolve path."""
        if v is None:
            return None
        return v.expanduser().resolve()


class SecurityConfig(BaseModel):
    """Security and authentication configuration."""

    enabled: bool = Field(default=True, description="Enable authentication")
    setup_completed: bool = Field(default=False, description="Whether initial setup has been completed")
    require_auth_during_setup: bool = Field(
        default=False, description="Require authentication during setup mode"
    )
    jwt_secret: Optional[str] = Field(default=None, description="JWT secret key")
    jwt_algorithm: str = Field(default="HS256", description="JWT algorithm")
    access_token_expire_minutes: int = Field(
        default=60 * 24 * 30,  # 30 days
        description="Access token expiration in minutes",
    )
    session_timeout_minutes: int = Field(
        default=60 * 24 * 7,  # 7 days of inactivity
        description="Session timeout after inactivity (minutes)",
    )
    session_timeout_warning_minutes: int = Field(
        default=5, description="Minutes before timeout to show warning"
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
    tls: TLSConfig = Field(default_factory=TLSConfig)
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

    # Environment mode (controls defaults for dev vs production)
    environment: Literal["development", "production"] = Field(
        default="production",
        description="Environment mode: 'development' or 'production'. Sets smart defaults for logging, debugging, and security.",
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

    # SD-card boot-flag reset path. When set, overrides the default boot-partition
    # search (/boot/firmware/yardrover-reset, /boot/yardrover-reset). If the file
    # exists at startup, credentials are wiped and setup mode re-entered.
    reset_flag_path: Optional[Path] = None

    # Network settings
    wifi_auto_connect: bool = Field(default=True)
    ap_mode_enabled: bool = Field(default=True)
    mdns_enabled: bool = Field(default=True)

    # RTCM settings
    rtcm_enabled: bool = Field(default=False)
    rtcm_output_to_fc: bool = Field(default=True)
    ntrip_host: Optional[str] = None
    ntrip_port: int = Field(default=2101)
    ntrip_mountpoint: Optional[str] = None
    ntrip_username: Optional[str] = None
    ntrip_password: Optional[str] = None

    # TLS/SSL settings
    tls_enabled: bool = Field(default=False)
    tls_cert_file: Optional[Path] = None
    tls_key_file: Optional[Path] = None
    tls_ca_certs: Optional[Path] = None
    tls_port: int = Field(default=443, ge=1, le=65535)

    # Server settings
    host: str = Field(default="0.0.0.0")
    port: int = Field(default=8000, ge=1, le=65535)
    workers: int = Field(default=2, ge=1, le=16)

    # Logging settings
    log_level: Optional[str] = Field(default=None)
    log_format: str = Field(default="json")

    # Development settings
    debug: Optional[bool] = Field(default=None)
    reload: Optional[bool] = Field(default=None)

    # Security settings
    security_enabled: bool = Field(default=True)
    setup_completed: bool = Field(default=False)
    require_auth_during_setup: bool = Field(default=False)
    jwt_secret: Optional[str] = Field(default=None)
    jwt_algorithm: str = Field(default="HS256")
    access_token_expire_minutes: int = Field(default=60 * 24 * 30)  # 30 days
    session_timeout_minutes: int = Field(default=60 * 24 * 7)  # 7 days
    session_timeout_warning_minutes: int = Field(default=5)
    api_key_header: str = Field(default="X-API-Key")
    allow_anonymous_health: bool = Field(default=True)
    allow_anonymous_docs: Optional[bool] = Field(default=None)
    rate_limit_enabled: Optional[bool] = Field(default=None)
    rate_limit_requests: int = Field(default=100)
    rate_limit_window_seconds: int = Field(default=60)
    cors_origins: Optional[list[str]] = Field(default=None)

    @model_validator(mode="after")
    def apply_environment_defaults(self) -> "Settings":
        """Apply environment-specific defaults if not explicitly set.

        Development mode defaults:
        - log_level: DEBUG
        - debug: True
        - reload: True
        - allow_anonymous_docs: True
        - rate_limit_enabled: False
        - cors_origins: ["*"]

        Production mode defaults:
        - log_level: INFO
        - debug: False
        - reload: False
        - allow_anonymous_docs: False
        - rate_limit_enabled: True
        - cors_origins: ["*"]
        """
        is_dev = self.environment == "development"

        # Apply defaults only if not explicitly set
        if self.log_level is None:
            self.log_level = "DEBUG" if is_dev else "INFO"

        if self.debug is None:
            self.debug = is_dev

        if self.reload is None:
            self.reload = is_dev

        if self.allow_anonymous_docs is None:
            self.allow_anonymous_docs = is_dev

        if self.rate_limit_enabled is None:
            self.rate_limit_enabled = not is_dev

        if self.cors_origins is None:
            self.cors_origins = ["*"]

        return self

    @field_validator("storage_path", "resource_storage_path", "tls_cert_file", "tls_key_file", "tls_ca_certs", "reset_flag_path")
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
                output_to_fc=self.rtcm_output_to_fc,
                source=NTRIPConfig(
                    host=self.ntrip_host,
                    port=self.ntrip_port,
                    mountpoint=self.ntrip_mountpoint,
                    username=self.ntrip_username,
                    password=self.ntrip_password,
                ),
            ),
            tls=TLSConfig(
                enabled=self.tls_enabled,
                cert_file=self.tls_cert_file,
                key_file=self.tls_key_file,
                ca_certs=self.tls_ca_certs,
                port=self.tls_port,
            ),
            security=SecurityConfig(
                enabled=self.security_enabled,
                setup_completed=self.setup_completed,
                require_auth_during_setup=self.require_auth_during_setup,
                jwt_secret=self.jwt_secret,
                jwt_algorithm=self.jwt_algorithm,
                access_token_expire_minutes=self.access_token_expire_minutes,
                session_timeout_minutes=self.session_timeout_minutes,
                session_timeout_warning_minutes=self.session_timeout_warning_minutes,
                api_key_header=self.api_key_header,
                allow_anonymous_health=self.allow_anonymous_health,
                allow_anonymous_docs=self.allow_anonymous_docs,
                rate_limit_enabled=self.rate_limit_enabled,
                rate_limit_requests=self.rate_limit_requests,
                rate_limit_window_seconds=self.rate_limit_window_seconds,
                cors_origins=self.cors_origins,
            ),
        )

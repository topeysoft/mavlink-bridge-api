"""Authentication and authorization data models."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class Role(str, Enum):
    """User roles for RBAC."""

    ADMIN = "admin"  # Full system access, config changes, user management
    OPERATOR = "operator"  # Control operations, MAVLink commands, no config changes
    VIEWER = "viewer"  # Read-only access to status and telemetry


class Permission(str, Enum):
    """Fine-grained permissions."""

    # Configuration
    CONFIG_READ = "config:read"
    CONFIG_WRITE = "config:write"

    # MAVLink & Control
    MAVLINK_READ = "mavlink:read"
    MAVLINK_WRITE = "mavlink:write"
    MAVLINK_ARM = "mavlink:arm"
    MAVLINK_DISARM = "mavlink:disarm"

    # Resources (zones, missions, tasks)
    RESOURCE_READ = "resource:read"
    RESOURCE_WRITE = "resource:write"
    RESOURCE_DELETE = "resource:delete"

    # WiFi & Network
    NETWORK_READ = "network:read"
    NETWORK_WRITE = "network:write"

    # RTCM/GPS
    RTCM_READ = "rtcm:read"
    RTCM_WRITE = "rtcm:write"

    # System
    SYSTEM_READ = "system:read"
    SYSTEM_RESTART = "system:restart"

    # User Management
    USER_READ = "user:read"
    USER_WRITE = "user:write"
    USER_DELETE = "user:delete"


# Role to permissions mapping
ROLE_PERMISSIONS: dict[Role, list[Permission]] = {
    Role.VIEWER: [
        Permission.CONFIG_READ,
        Permission.MAVLINK_READ,
        Permission.RESOURCE_READ,
        Permission.NETWORK_READ,
        Permission.RTCM_READ,
        Permission.SYSTEM_READ,
    ],
    Role.OPERATOR: [
        Permission.CONFIG_READ,
        Permission.MAVLINK_READ,
        Permission.MAVLINK_WRITE,
        Permission.MAVLINK_ARM,
        Permission.MAVLINK_DISARM,
        Permission.RESOURCE_READ,
        Permission.RESOURCE_WRITE,
        Permission.RESOURCE_DELETE,
        Permission.NETWORK_READ,
        Permission.RTCM_READ,
        Permission.RTCM_WRITE,
        Permission.SYSTEM_READ,
    ],
    Role.ADMIN: [
        # Admin has all permissions
        Permission.CONFIG_READ,
        Permission.CONFIG_WRITE,
        Permission.MAVLINK_READ,
        Permission.MAVLINK_WRITE,
        Permission.MAVLINK_ARM,
        Permission.MAVLINK_DISARM,
        Permission.RESOURCE_READ,
        Permission.RESOURCE_WRITE,
        Permission.RESOURCE_DELETE,
        Permission.NETWORK_READ,
        Permission.NETWORK_WRITE,
        Permission.RTCM_READ,
        Permission.RTCM_WRITE,
        Permission.SYSTEM_READ,
        Permission.SYSTEM_RESTART,
        Permission.USER_READ,
        Permission.USER_WRITE,
        Permission.USER_DELETE,
    ],
}


class APIKey(BaseModel):
    """API key data model."""

    key_id: str = Field(..., description="Unique identifier for the key")
    name: str = Field(..., description="Human-readable name for the key")
    role: Role = Field(default=Role.VIEWER, description="Role assigned to this key")
    hashed_key: str = Field(..., description="Bcrypt hashed API key")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = Field(default=None, description="Expiration date")
    last_used_at: Optional[datetime] = Field(default=None)
    enabled: bool = Field(default=True)
    description: Optional[str] = Field(default=None)

    def is_expired(self) -> bool:
        """Check if key is expired."""
        if self.expires_at is None:
            return False
        return datetime.utcnow() > self.expires_at

    def is_valid(self) -> bool:
        """Check if key is valid (enabled and not expired)."""
        return self.enabled and not self.is_expired()


class TokenData(BaseModel):
    """JWT token payload data."""

    sub: str = Field(..., description="Subject (API key ID or username)")
    role: Role = Field(..., description="User role")
    permissions: list[Permission] = Field(default_factory=list)
    exp: Optional[datetime] = Field(default=None, description="Expiration time")
    iat: Optional[datetime] = Field(default=None, description="Issued at time")
    jti: Optional[str] = Field(default=None, description="JWT ID (unique token identifier)")
    token_type: Optional[str] = Field(default=None, description="Token type (access/refresh)")


class SecurityContext(BaseModel):
    """Security context for authenticated requests."""

    # Subject identifier (either API key ID or user ID)
    subject_id: str = Field(..., description="API key ID or user ID")
    subject_type: str = Field(..., description="Type of subject: 'api_key' or 'user'")
    subject_name: str = Field(..., description="API key name or username")
    role: Role = Field(..., description="Role")
    permissions: list[Permission] = Field(default_factory=list)
    authenticated: bool = Field(default=True)

    # Backward compatibility aliases
    @property
    def api_key_id(self) -> str:
        """Backward compatibility: return subject_id."""
        return self.subject_id

    @property
    def api_key_name(self) -> str:
        """Backward compatibility: return subject_name."""
        return self.subject_name

    def has_permission(self, permission: Permission) -> bool:
        """Check if context has specific permission."""
        return permission in self.permissions

    def has_role(self, role: Role) -> bool:
        """Check if context has specific role."""
        return self.role == role

    def has_any_role(self, *roles: Role) -> bool:
        """Check if context has any of the specified roles."""
        return self.role in roles


class AuthConfig(BaseModel):
    """Authentication configuration."""

    enabled: bool = Field(default=True, description="Enable authentication")
    jwt_secret: str = Field(..., description="JWT secret key")
    jwt_algorithm: str = Field(default="HS256", description="JWT algorithm")
    access_token_expire_minutes: int = Field(
        default=60 * 24 * 30,  # 30 days
        description="Access token expiration in minutes",
    )
    api_key_header: str = Field(
        default="X-API-Key", description="HTTP header for API key"
    )
    allow_anonymous_health: bool = Field(
        default=True, description="Allow unauthenticated access to /api/health"
    )
    allow_anonymous_docs: bool = Field(
        default=False, description="Allow unauthenticated access to API docs"
    )
    rate_limit_enabled: bool = Field(default=True, description="Enable rate limiting")
    rate_limit_requests: int = Field(
        default=100, description="Max requests per window"
    )
    rate_limit_window_seconds: int = Field(
        default=60, description="Rate limit window in seconds"
    )


class LoginRequest(BaseModel):
    """Login request with API key."""

    api_key: str = Field(..., description="API key")


class LoginResponse(BaseModel):
    """Login response with JWT tokens."""

    access_token: str = Field(..., description="JWT access token (short-lived)")
    refresh_token: str = Field(..., description="JWT refresh token (long-lived)")
    token_type: str = Field(default="bearer", description="Token type")
    expires_in: int = Field(..., description="Access token expiration in seconds")
    role: Role = Field(..., description="User role")


class RefreshTokenRequest(BaseModel):
    """Request to refresh an access token."""

    refresh_token: str = Field(..., description="Refresh token")


class RefreshTokenResponse(BaseModel):
    """Response with new access token."""

    access_token: str = Field(..., description="New JWT access token")
    token_type: str = Field(default="bearer", description="Token type")
    expires_in: int = Field(..., description="Access token expiration in seconds")


class LogoutRequest(BaseModel):
    """Request to logout and revoke refresh token."""

    refresh_token: str = Field(..., description="Refresh token to revoke")


class APIKeyCreateRequest(BaseModel):
    """Request to create a new API key."""

    name: str = Field(..., min_length=1, max_length=128, description="Key name")
    role: Role = Field(default=Role.VIEWER, description="Role for this key")
    description: Optional[str] = Field(default=None, max_length=512)
    expires_in_days: Optional[int] = Field(default=None, ge=1, le=365)


class APIKeyCreateResponse(BaseModel):
    """Response after creating API key (includes plaintext key once)."""

    key_id: str = Field(..., description="Key ID")
    name: str = Field(..., description="Key name")
    api_key: str = Field(..., description="Plaintext API key (save this!)")
    role: Role = Field(..., description="Role")
    created_at: datetime = Field(..., description="Creation timestamp")
    expires_at: Optional[datetime] = Field(default=None)


class APIKeyListItem(BaseModel):
    """API key list item (no sensitive data)."""

    key_id: str
    name: str
    role: Role
    created_at: datetime
    expires_at: Optional[datetime]
    last_used_at: Optional[datetime]
    enabled: bool
    description: Optional[str]


class User(BaseModel):
    """User account with username/password authentication."""

    user_id: str = Field(..., description="Unique identifier for the user")
    username: str = Field(..., min_length=1, max_length=64, description="Unique username")
    role: Role = Field(default=Role.VIEWER, description="Role assigned to this user")
    hashed_password: str = Field(..., description="Bcrypt hashed password")
    hashed_pin: Optional[str] = Field(default=None, description="Optional bcrypt hashed PIN (4-6 digits)")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login_at: Optional[datetime] = Field(default=None)
    enabled: bool = Field(default=True)
    display_name: Optional[str] = Field(default=None, max_length=128, description="Display name")

    def is_valid(self) -> bool:
        """Check if user is valid (enabled)."""
        return self.enabled


class UserLoginRequest(BaseModel):
    """Login request with username and password."""

    username: str = Field(..., min_length=1, max_length=64, description="Username")
    password: str = Field(..., min_length=1, max_length=128, description="Password")


class PinLoginRequest(BaseModel):
    """Login request with PIN."""

    pin: str = Field(..., min_length=4, max_length=6, pattern=r"^\d+$", description="4-6 digit PIN")


class ChangePasswordRequest(BaseModel):
    """Request to change user password."""

    old_password: str = Field(..., min_length=1, max_length=128, description="Current password")
    new_password: str = Field(..., min_length=8, max_length=128, description="New password (min 8 chars)")


class SetPinRequest(BaseModel):
    """Request to set or update user PIN."""

    pin: str = Field(..., min_length=4, max_length=6, pattern=r"^\d+$", description="4-6 digit PIN")
    password: str = Field(..., min_length=1, max_length=128, description="Current password for verification")


class UserCreateRequest(BaseModel):
    """Request to create a new user."""

    username: str = Field(..., min_length=1, max_length=64, description="Unique username")
    password: str = Field(..., min_length=8, max_length=128, description="Password (min 8 chars)")
    role: Role = Field(default=Role.VIEWER, description="Role for this user")
    display_name: Optional[str] = Field(default=None, max_length=128, description="Display name")
    pin: Optional[str] = Field(default=None, min_length=4, max_length=6, pattern=r"^\d+$", description="Optional 4-6 digit PIN")


class UserListItem(BaseModel):
    """User list item (no sensitive data)."""

    user_id: str
    username: str
    role: Role
    created_at: datetime
    last_login_at: Optional[datetime]
    enabled: bool
    display_name: Optional[str]
    has_pin: bool = Field(description="Whether user has PIN configured")

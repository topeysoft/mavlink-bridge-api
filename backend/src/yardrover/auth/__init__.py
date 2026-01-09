"""Authentication and authorization module.

This module provides:
- API key authentication with bcrypt hashing
- User authentication with username/password and PIN
- JWT token generation and validation
- Role-based access control (RBAC)
- FastAPI dependency injection for auth
- Audit logging for security events
"""

from .api_keys import APIKeyManager, get_api_key_manager, verify_api_key
from .dependencies import (
    get_current_api_key,
    require_admin,
    require_authenticated,
    require_operator,
    require_viewer,
)
from .jwt_handler import JWTHandler, create_access_token, verify_token
from .models import (
    APIKey,
    APIKeyCreateRequest,
    APIKeyCreateResponse,
    APIKeyListItem,
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
    Permission,
    PinLoginRequest,
    Role,
    SecurityContext,
    SetPinRequest,
    TokenData,
    User,
    UserCreateRequest,
    UserListItem,
    UserLoginRequest,
)
from .rbac import has_permission, require_permission
from .users import UserManager, get_user_manager, hash_password, hash_pin, verify_password, verify_pin

__all__ = [
    # API Keys
    "APIKeyManager",
    "get_api_key_manager",
    "verify_api_key",
    # Users
    "UserManager",
    "get_user_manager",
    "hash_password",
    "hash_pin",
    "verify_password",
    "verify_pin",
    # JWT
    "JWTHandler",
    "create_access_token",
    "verify_token",
    # Models
    "APIKey",
    "APIKeyCreateRequest",
    "APIKeyCreateResponse",
    "APIKeyListItem",
    "LoginRequest",
    "LoginResponse",
    "Role",
    "Permission",
    "SecurityContext",
    "TokenData",
    "User",
    "UserCreateRequest",
    "UserListItem",
    "UserLoginRequest",
    "PinLoginRequest",
    "ChangePasswordRequest",
    "SetPinRequest",
    # RBAC
    "has_permission",
    "require_permission",
    # Dependencies
    "get_current_api_key",
    "require_authenticated",
    "require_admin",
    "require_operator",
    "require_viewer",
]

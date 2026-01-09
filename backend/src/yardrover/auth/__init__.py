"""Authentication and authorization module.

This module provides:
- API key authentication with bcrypt hashing
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
    LoginRequest,
    LoginResponse,
    Permission,
    Role,
    SecurityContext,
    TokenData,
)
from .rbac import has_permission, require_permission

__all__ = [
    # API Keys
    "APIKeyManager",
    "get_api_key_manager",
    "verify_api_key",
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

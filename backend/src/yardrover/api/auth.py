"""Authentication API endpoints."""

from datetime import datetime

import structlog
from fastapi import APIRouter, Depends, HTTPException, status

from yardrover.auth import (
    APIKeyCreateRequest,
    APIKeyCreateResponse,
    APIKeyListItem,
    LoginRequest,
    LoginResponse,
    Role,
    SecurityContext,
    create_access_token,
    get_api_key_manager,
    require_admin,
)
from yardrover.auth.rbac import get_role_permissions

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest) -> LoginResponse:
    """Login with API key and receive JWT token.

    This endpoint exchanges an API key for a JWT token that can be used
    for subsequent requests. JWT tokens have a limited lifetime.

    Args:
        request: Login request with API key

    Returns:
        JWT access token and metadata

    Raises:
        HTTPException: If API key is invalid
    """
    api_key_manager = get_api_key_manager()
    api_key = api_key_manager.verify_key(request.api_key)

    if api_key is None:
        logger.warning("login_failed", reason="invalid_api_key")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )

    # Get permissions for role
    permissions = get_role_permissions(api_key.role)

    # Create JWT token
    token = create_access_token(
        subject=api_key.key_id,
        role=api_key.role,
        permissions=[p.value for p in permissions],
    )

    logger.info(
        "user_logged_in",
        key_id=api_key.key_id,
        key_name=api_key.name,
        role=api_key.role.value,
    )

    # Calculate expiration (30 days default)
    expires_in = 60 * 60 * 24 * 30

    return LoginResponse(
        access_token=token,
        token_type="bearer",
        expires_in=expires_in,
        role=api_key.role,
    )


@router.post("/api-keys", response_model=APIKeyCreateResponse)
async def create_api_key(
    request: APIKeyCreateRequest,
    context: SecurityContext = Depends(require_admin),
) -> APIKeyCreateResponse:
    """Create a new API key (admin only).

    Args:
        request: API key creation request
        context: Security context (admin required)

    Returns:
        Created API key with plaintext key (shown only once)

    Raises:
        HTTPException: If creation fails
    """
    api_key_manager = get_api_key_manager()

    # Create the key
    api_key, plaintext_key = api_key_manager.create_key(
        name=request.name,
        role=request.role,
        description=request.description,
        expires_in_days=request.expires_in_days,
    )

    logger.info(
        "api_key_created",
        key_id=api_key.key_id,
        name=api_key.name,
        role=api_key.role.value,
        created_by=context.api_key_name,
    )

    return APIKeyCreateResponse(
        key_id=api_key.key_id,
        name=api_key.name,
        api_key=plaintext_key,
        role=api_key.role,
        created_at=api_key.created_at,
        expires_at=api_key.expires_at,
    )


@router.get("/api-keys", response_model=list[APIKeyListItem])
async def list_api_keys(
    context: SecurityContext = Depends(require_admin),
) -> list[APIKeyListItem]:
    """List all API keys (admin only).

    Args:
        context: Security context (admin required)

    Returns:
        List of API keys (no sensitive data)
    """
    api_key_manager = get_api_key_manager()
    keys = api_key_manager.list_keys()

    return [
        APIKeyListItem(
            key_id=key.key_id,
            name=key.name,
            role=key.role,
            created_at=key.created_at,
            expires_at=key.expires_at,
            last_used_at=key.last_used_at,
            enabled=key.enabled,
            description=key.description,
        )
        for key in keys
    ]


@router.delete("/api-keys/{key_id}")
async def delete_api_key(
    key_id: str,
    context: SecurityContext = Depends(require_admin),
) -> dict[str, str]:
    """Delete an API key permanently (admin only).

    Args:
        key_id: Key ID to delete
        context: Security context (admin required)

    Returns:
        Success message

    Raises:
        HTTPException: If key not found
    """
    api_key_manager = get_api_key_manager()

    # Prevent self-deletion
    if key_id == context.api_key_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own API key",
        )

    if not api_key_manager.delete_key(key_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found",
        )

    logger.info(
        "api_key_deleted",
        key_id=key_id,
        deleted_by=context.api_key_name,
    )

    return {"message": "API key deleted successfully"}


@router.patch("/api-keys/{key_id}/enable")
async def enable_api_key(
    key_id: str,
    context: SecurityContext = Depends(require_admin),
) -> dict[str, str]:
    """Enable a disabled API key (admin only).

    Args:
        key_id: Key ID to enable
        context: Security context (admin required)

    Returns:
        Success message

    Raises:
        HTTPException: If key not found
    """
    api_key_manager = get_api_key_manager()

    if not api_key_manager.enable_key(key_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found",
        )

    logger.info(
        "api_key_enabled",
        key_id=key_id,
        enabled_by=context.api_key_name,
    )

    return {"message": "API key enabled successfully"}


@router.patch("/api-keys/{key_id}/revoke")
async def revoke_api_key(
    key_id: str,
    context: SecurityContext = Depends(require_admin),
) -> dict[str, str]:
    """Revoke (disable) an API key (admin only).

    Args:
        key_id: Key ID to revoke
        context: Security context (admin required)

    Returns:
        Success message

    Raises:
        HTTPException: If key not found
    """
    api_key_manager = get_api_key_manager()

    # Prevent self-revocation
    if key_id == context.api_key_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot revoke your own API key",
        )

    if not api_key_manager.revoke_key(key_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found",
        )

    logger.info(
        "api_key_revoked",
        key_id=key_id,
        revoked_by=context.api_key_name,
    )

    return {"message": "API key revoked successfully"}


@router.patch("/api-keys/{key_id}/role")
async def update_api_key_role(
    key_id: str,
    role: Role,
    context: SecurityContext = Depends(require_admin),
) -> dict[str, str]:
    """Update an API key's role (admin only).

    Args:
        key_id: Key ID to update
        role: New role
        context: Security context (admin required)

    Returns:
        Success message

    Raises:
        HTTPException: If key not found
    """
    api_key_manager = get_api_key_manager()

    if not api_key_manager.update_key_role(key_id, role):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found",
        )

    logger.info(
        "api_key_role_updated",
        key_id=key_id,
        new_role=role.value,
        updated_by=context.api_key_name,
    )

    return {"message": f"API key role updated to {role.value}"}


@router.get("/me", response_model=dict)
async def get_current_user(
    context: SecurityContext = Depends(require_admin),
) -> dict:
    """Get current authenticated user information.

    Args:
        context: Security context

    Returns:
        Current user information
    """
    return {
        "api_key_id": context.api_key_id,
        "api_key_name": context.api_key_name,
        "role": context.role.value,
        "permissions": [p.value for p in context.permissions],
        "authenticated": context.authenticated,
    }

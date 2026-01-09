"""Authentication API endpoints."""

from datetime import datetime

import structlog
from fastapi import APIRouter, Depends, HTTPException, status

from yardrover.auth import (
    APIKeyCreateRequest,
    APIKeyCreateResponse,
    APIKeyListItem,
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
    PinLoginRequest,
    Role,
    SecurityContext,
    SetPinRequest,
    UserCreateRequest,
    UserListItem,
    UserLoginRequest,
    create_access_token,
    get_api_key_manager,
    get_user_manager,
    require_admin,
    require_authenticated,
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

    # Create JWT token with subject type
    token = create_access_token(
        subject=f"api_key:{api_key.key_id}",
        role=api_key.role,
        permissions=[p.value for p in permissions],
    )

    logger.info(
        "user_logged_in",
        subject_type="api_key",
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


@router.post("/login/password", response_model=LoginResponse)
async def login_with_password(request: UserLoginRequest) -> LoginResponse:
    """Login with username and password and receive JWT token.

    This endpoint exchanges username and password for a JWT token that can
    be used for subsequent requests. JWT tokens have a limited lifetime.

    Args:
        request: Login request with username and password

    Returns:
        JWT access token and metadata

    Raises:
        HTTPException: If credentials are invalid
    """
    user_manager = get_user_manager()
    user = user_manager.verify_user_password(request.username, request.password)

    if user is None:
        logger.warning("login_failed", reason="invalid_credentials", username=request.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    # Get permissions for role
    permissions = get_role_permissions(user.role)

    # Create JWT token with subject type
    token = create_access_token(
        subject=f"user:{user.user_id}",
        role=user.role,
        permissions=[p.value for p in permissions],
    )

    logger.info(
        "user_logged_in",
        subject_type="user",
        user_id=user.user_id,
        username=user.username,
        role=user.role.value,
    )

    # Calculate expiration (30 days default)
    expires_in = 60 * 60 * 24 * 30

    return LoginResponse(
        access_token=token,
        token_type="bearer",
        expires_in=expires_in,
        role=user.role,
    )


@router.post("/login/pin", response_model=LoginResponse)
async def login_with_pin(request: PinLoginRequest) -> LoginResponse:
    """Login with PIN and receive JWT token.

    This endpoint exchanges a PIN for a JWT token that can be used for
    subsequent requests. JWT tokens have a limited lifetime.

    Args:
        request: Login request with PIN

    Returns:
        JWT access token and metadata

    Raises:
        HTTPException: If PIN is invalid
    """
    user_manager = get_user_manager()
    user = user_manager.verify_user_pin(request.pin)

    if user is None:
        logger.warning("login_failed", reason="invalid_pin")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid PIN",
        )

    # Get permissions for role
    permissions = get_role_permissions(user.role)

    # Create JWT token with subject type
    token = create_access_token(
        subject=f"user:{user.user_id}",
        role=user.role,
        permissions=[p.value for p in permissions],
    )

    logger.info(
        "user_logged_in",
        subject_type="user",
        user_id=user.user_id,
        username=user.username,
        role=user.role.value,
        method="pin",
    )

    # Calculate expiration (30 days default)
    expires_in = 60 * 60 * 24 * 30

    return LoginResponse(
        access_token=token,
        token_type="bearer",
        expires_in=expires_in,
        role=user.role,
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
    context: SecurityContext = Depends(require_authenticated),
) -> dict:
    """Get current authenticated user information.

    Args:
        context: Security context

    Returns:
        Current user information
    """
    return {
        "subject_id": context.subject_id,
        "subject_type": context.subject_type,
        "subject_name": context.subject_name,
        "role": context.role.value,
        "permissions": [p.value for p in context.permissions],
        "authenticated": context.authenticated,
        # Backward compatibility
        "api_key_id": context.api_key_id,
        "api_key_name": context.api_key_name,
    }


# ============================================================================
# User Management Endpoints
# ============================================================================


@router.post("/users", response_model=dict)
async def create_user(
    request: UserCreateRequest,
    context: SecurityContext = Depends(require_admin),
) -> dict:
    """Create a new user account (admin only).

    Args:
        request: User creation request
        context: Security context (admin required)

    Returns:
        Created user information

    Raises:
        HTTPException: If creation fails or username exists
    """
    user_manager = get_user_manager()

    try:
        user = user_manager.create_user(
            username=request.username,
            password=request.password,
            role=request.role,
            display_name=request.display_name,
            pin=request.pin,
        )

        logger.info(
            "user_created",
            user_id=user.user_id,
            username=user.username,
            role=user.role.value,
            created_by=context.subject_name,
        )

        return {
            "user_id": user.user_id,
            "username": user.username,
            "role": user.role.value,
            "display_name": user.display_name,
            "has_pin": user.hashed_pin is not None,
            "created_at": user.created_at.isoformat(),
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e


@router.get("/users", response_model=list[UserListItem])
async def list_users(
    context: SecurityContext = Depends(require_admin),
) -> list[UserListItem]:
    """List all user accounts (admin only).

    Args:
        context: Security context (admin required)

    Returns:
        List of users (no sensitive data)
    """
    user_manager = get_user_manager()
    users = user_manager.list_users()

    return [
        UserListItem(
            user_id=user.user_id,
            username=user.username,
            role=user.role,
            created_at=user.created_at,
            last_login_at=user.last_login_at,
            enabled=user.enabled,
            display_name=user.display_name,
            has_pin=user.hashed_pin is not None,
        )
        for user in users
    ]


@router.post("/password/change")
async def change_password(
    request: ChangePasswordRequest,
    context: SecurityContext = Depends(require_authenticated),
) -> dict[str, str]:
    """Change current user's password.

    Args:
        request: Password change request
        context: Security context (authenticated user)

    Returns:
        Success message

    Raises:
        HTTPException: If password change fails
    """
    # Only allow users to change their own password
    if context.subject_type != "user":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password change is only available for user accounts, not API keys",
        )

    user_manager = get_user_manager()

    if not user_manager.change_password(
        context.subject_id, request.old_password, request.new_password
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password change failed. Please check your current password and try again.",
        )

    logger.info("password_changed", user_id=context.subject_id, username=context.subject_name)

    return {"message": "Password changed successfully"}


@router.post("/pin/set")
async def set_pin(
    request: SetPinRequest,
    context: SecurityContext = Depends(require_authenticated),
) -> dict[str, str]:
    """Set or update PIN for current user.

    Args:
        request: PIN setup request
        context: Security context (authenticated user)

    Returns:
        Success message

    Raises:
        HTTPException: If PIN setup fails
    """
    # Only allow users to set PIN
    if context.subject_type != "user":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PIN setup is only available for user accounts, not API keys",
        )

    user_manager = get_user_manager()

    if not user_manager.set_pin(context.subject_id, request.pin, request.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PIN setup failed. Please check your password and try again.",
        )

    logger.info("pin_set", user_id=context.subject_id, username=context.subject_name)

    return {"message": "PIN set successfully"}


@router.delete("/pin")
async def remove_pin(
    password: str,
    context: SecurityContext = Depends(require_authenticated),
) -> dict[str, str]:
    """Remove PIN for current user.

    Args:
        password: Current password for verification
        context: Security context (authenticated user)

    Returns:
        Success message

    Raises:
        HTTPException: If PIN removal fails
    """
    # Only allow users to remove PIN
    if context.subject_type != "user":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PIN removal is only available for user accounts, not API keys",
        )

    user_manager = get_user_manager()

    if not user_manager.remove_pin(context.subject_id, password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PIN removal failed. Please check your password and try again.",
        )

    logger.info("pin_removed", user_id=context.subject_id, username=context.subject_name)

    return {"message": "PIN removed successfully"}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    context: SecurityContext = Depends(require_admin),
) -> dict[str, str]:
    """Delete a user account permanently (admin only).

    Args:
        user_id: User ID to delete
        context: Security context (admin required)

    Returns:
        Success message

    Raises:
        HTTPException: If user not found or attempting self-deletion
    """
    # Prevent self-deletion
    if user_id == context.subject_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own user account",
        )

    user_manager = get_user_manager()

    if not user_manager.delete_user(user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    logger.info(
        "user_deleted",
        user_id=user_id,
        deleted_by=context.subject_name,
    )

    return {"message": "User deleted successfully"}


@router.patch("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    role: Role,
    context: SecurityContext = Depends(require_admin),
) -> dict[str, str]:
    """Update a user's role (admin only).

    Args:
        user_id: User ID to update
        role: New role
        context: Security context (admin required)

    Returns:
        Success message

    Raises:
        HTTPException: If user not found
    """
    user_manager = get_user_manager()

    if not user_manager.update_user_role(user_id, role):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    logger.info(
        "user_role_updated",
        user_id=user_id,
        new_role=role.value,
        updated_by=context.subject_name,
    )

    return {"message": f"User role updated to {role.value}"}

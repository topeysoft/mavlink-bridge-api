"""FastAPI dependency injection for authentication and authorization."""

from typing import Optional

import structlog
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .api_keys import get_api_key_manager
from .jwt_handler import get_jwt_handler
from .models import Permission, Role, SecurityContext
from .rbac import get_role_permissions
from .users import get_user_manager

logger = structlog.get_logger(__name__)

# HTTP Bearer scheme for JWT tokens
bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    authorization: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> SecurityContext:
    """Get current API key from request headers.

    Supports two authentication methods:
    1. X-API-Key header with API key
    2. Authorization: Bearer <jwt_token> header

    Args:
        x_api_key: API key from X-API-Key header
        authorization: JWT token from Authorization header

    Returns:
        SecurityContext for the authenticated request

    Raises:
        HTTPException: If authentication fails
    """
    # Try JWT token first
    if authorization:
        try:
            jwt_handler = get_jwt_handler()
            token_data = jwt_handler.verify_token(authorization.credentials)

            if token_data is None:
                logger.warning("jwt_authentication_failed", reason="invalid_token")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired token",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            # Parse subject: format is "type:id" (e.g., "user:uuid" or "api_key:uuid")
            subject_parts = token_data.sub.split(":", 1)
            if len(subject_parts) == 2:
                subject_type, subject_id = subject_parts
            else:
                # Backward compatibility: assume api_key if no prefix
                subject_type = "api_key"
                subject_id = token_data.sub

            # Get subject name based on type
            subject_name = f"JWT:{subject_id}"
            if subject_type == "user":
                user_manager = get_user_manager()
                user = user_manager.get_user(subject_id)
                if user:
                    subject_name = user.username
            elif subject_type == "api_key":
                api_key_manager = get_api_key_manager()
                api_key = api_key_manager.get_key(subject_id)
                if api_key:
                    subject_name = api_key.name

            # Create security context from token
            context = SecurityContext(
                subject_id=subject_id,
                subject_type=subject_type,
                subject_name=subject_name,
                role=token_data.role,
                permissions=token_data.permissions,
            )

            logger.debug(
                "jwt_authentication_successful",
                subject_type=subject_type,
                subject_id=subject_id,
                role=token_data.role.value,
            )

            return context

        except RuntimeError:
            # JWT handler not initialized, fall through to API key
            logger.debug("jwt_handler_not_initialized")
            pass

    # Try API key
    if x_api_key:
        api_key_manager = get_api_key_manager()
        api_key = api_key_manager.verify_key(x_api_key)

        if api_key is None:
            logger.warning("api_key_authentication_failed", reason="invalid_key")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired API key",
                headers={"WWW-Authenticate": 'ApiKey realm="X-API-Key"'},
            )

        # Create security context
        permissions = get_role_permissions(api_key.role)
        context = SecurityContext(
            subject_id=api_key.key_id,
            subject_type="api_key",
            subject_name=api_key.name,
            role=api_key.role,
            permissions=permissions,
        )

        logger.debug(
            "api_key_authentication_successful",
            key_id=api_key.key_id,
            key_name=api_key.name,
            role=api_key.role.value,
        )

        return context

    # No authentication provided
    logger.warning("authentication_required", reason="no_credentials")
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Provide X-API-Key header or Authorization Bearer token.",
        headers={"WWW-Authenticate": 'ApiKey realm="X-API-Key"'},
    )


async def require_authenticated(
    context: SecurityContext = Depends(get_current_api_key),
) -> SecurityContext:
    """Require any authenticated user (any role).

    Args:
        context: Security context from dependency

    Returns:
        SecurityContext

    Raises:
        HTTPException: If not authenticated
    """
    return context


async def require_permission_dep(permission: Permission):
    """Create a dependency that requires a specific permission.

    Args:
        permission: Required permission

    Returns:
        FastAPI dependency function
    """

    async def dependency(
        context: SecurityContext = Depends(get_current_api_key),
    ) -> SecurityContext:
        if permission not in context.permissions:
            logger.warning(
                "permission_denied",
                key_id=context.api_key_id,
                key_name=context.api_key_name,
                role=context.role.value,
                required_permission=permission.value,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission.value}' required",
            )
        return context

    return dependency


async def require_viewer(
    context: SecurityContext = Depends(get_current_api_key),
) -> SecurityContext:
    """Require at least viewer role (viewer, operator, or admin).

    Args:
        context: Security context from dependency

    Returns:
        SecurityContext

    Raises:
        HTTPException: If insufficient permissions
    """
    # All authenticated users have at least viewer permissions
    return context


async def require_operator(
    context: SecurityContext = Depends(get_current_api_key),
) -> SecurityContext:
    """Require at least operator role (operator or admin).

    Args:
        context: Security context from dependency

    Returns:
        SecurityContext

    Raises:
        HTTPException: If insufficient permissions
    """
    if context.role not in [Role.OPERATOR, Role.ADMIN]:
        logger.warning(
            "insufficient_role",
            key_id=context.api_key_id,
            key_name=context.api_key_name,
            role=context.role.value,
            required_role="operator",
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Operator or Admin role required. Current role: {context.role.value}",
        )
    return context


async def require_admin(
    context: SecurityContext = Depends(get_current_api_key),
) -> SecurityContext:
    """Require admin role.

    Args:
        context: Security context from dependency

    Returns:
        SecurityContext

    Raises:
        HTTPException: If not admin
    """
    if context.role != Role.ADMIN:
        logger.warning(
            "admin_required",
            key_id=context.api_key_id,
            key_name=context.api_key_name,
            role=context.role.value,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Admin role required. Current role: {context.role.value}",
        )
    return context


# Optional authentication (allows anonymous access but provides context if authenticated)
async def get_optional_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    authorization: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Optional[SecurityContext]:
    """Get current API key if provided, otherwise return None (allow anonymous).

    Args:
        x_api_key: API key from X-API-Key header
        authorization: JWT token from Authorization header

    Returns:
        SecurityContext if authenticated, None otherwise
    """
    try:
        return await get_current_api_key(x_api_key, authorization)
    except HTTPException:
        # Authentication failed or not provided, return None
        return None


async def verify_websocket_token(token: str) -> SecurityContext:
    """Verify JWT token for WebSocket authentication.

    WebSocket connections cannot use standard FastAPI dependencies,
    so this function provides token verification for WebSocket endpoints.

    Args:
        token: JWT token from query parameter

    Returns:
        SecurityContext for the authenticated connection

    Raises:
        HTTPException: If token is invalid or expired
    """
    try:
        jwt_handler = get_jwt_handler()
        token_data = jwt_handler.verify_token(token)

        if token_data is None:
            logger.warning("websocket_auth_failed", reason="invalid_token")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )

        # Parse subject: format is "type:id" (e.g., "user:uuid" or "api_key:uuid")
        subject_parts = token_data.sub.split(":", 1)
        if len(subject_parts) == 2:
            subject_type, subject_id = subject_parts
        else:
            # Backward compatibility: assume api_key if no prefix
            subject_type = "api_key"
            subject_id = token_data.sub

        # Get subject name based on type
        subject_name = f"JWT:{subject_id}"
        if subject_type == "user":
            user_manager = get_user_manager()
            user = user_manager.get_user(subject_id)
            if user:
                subject_name = user.username
        elif subject_type == "api_key":
            api_key_manager = get_api_key_manager()
            api_key = api_key_manager.get_key(subject_id)
            if api_key:
                subject_name = api_key.name

        # Create security context from token
        context = SecurityContext(
            subject_id=subject_id,
            subject_type=subject_type,
            subject_name=subject_name,
            role=token_data.role,
            permissions=token_data.permissions,
        )

        logger.debug(
            "websocket_auth_successful",
            subject_type=subject_type,
            subject_id=subject_id,
            role=token_data.role.value,
        )

        return context

    except RuntimeError as e:
        logger.error("websocket_auth_error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service not available",
        )

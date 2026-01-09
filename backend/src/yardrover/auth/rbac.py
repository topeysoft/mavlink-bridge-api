"""Role-Based Access Control (RBAC) utilities."""

import structlog

from .models import Permission, Role, ROLE_PERMISSIONS, SecurityContext

logger = structlog.get_logger(__name__)


def get_role_permissions(role: Role) -> list[Permission]:
    """Get all permissions for a role.

    Args:
        role: User role

    Returns:
        List of permissions for this role
    """
    return ROLE_PERMISSIONS.get(role, [])


def has_permission(context: SecurityContext, permission: Permission) -> bool:
    """Check if a security context has a specific permission.

    Args:
        context: Security context
        permission: Permission to check

    Returns:
        True if context has permission, False otherwise
    """
    return permission in context.permissions


def require_permission(context: SecurityContext, permission: Permission) -> None:
    """Require a specific permission, raise exception if not present.

    Args:
        context: Security context
        permission: Permission to require

    Raises:
        PermissionError: If permission not present
    """
    if not has_permission(context, permission):
        logger.warning(
            "permission_denied",
            key_id=context.api_key_id,
            key_name=context.api_key_name,
            role=context.role.value,
            required_permission=permission.value,
        )
        raise PermissionError(
            f"Permission '{permission.value}' required. Current role: {context.role.value}"
        )


def has_role(context: SecurityContext, role: Role) -> bool:
    """Check if a security context has a specific role.

    Args:
        context: Security context
        role: Role to check

    Returns:
        True if context has role, False otherwise
    """
    return context.role == role


def has_any_role(context: SecurityContext, *roles: Role) -> bool:
    """Check if a security context has any of the specified roles.

    Args:
        context: Security context
        roles: Roles to check

    Returns:
        True if context has any of the roles, False otherwise
    """
    return context.role in roles


def require_role(context: SecurityContext, role: Role) -> None:
    """Require a specific role, raise exception if not present.

    Args:
        context: Security context
        role: Role to require

    Raises:
        PermissionError: If role not present
    """
    if not has_role(context, role):
        logger.warning(
            "role_required",
            key_id=context.api_key_id,
            key_name=context.api_key_name,
            current_role=context.role.value,
            required_role=role.value,
        )
        raise PermissionError(
            f"Role '{role.value}' required. Current role: {context.role.value}"
        )


def require_any_role(context: SecurityContext, *roles: Role) -> None:
    """Require any of the specified roles, raise exception if none present.

    Args:
        context: Security context
        roles: Roles to require (any)

    Raises:
        PermissionError: If no matching role present
    """
    if not has_any_role(context, *roles):
        role_names = ", ".join(r.value for r in roles)
        logger.warning(
            "roles_required",
            key_id=context.api_key_id,
            key_name=context.api_key_name,
            current_role=context.role.value,
            required_roles=role_names,
        )
        raise PermissionError(
            f"One of these roles required: {role_names}. Current role: {context.role.value}"
        )

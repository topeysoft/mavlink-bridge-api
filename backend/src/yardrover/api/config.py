"""Configuration API endpoints."""

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError

from yardrover.auth import Permission, SecurityContext, require_viewer, require_admin
from yardrover.auth.dependencies import require_permission_dep
from yardrover.core.config import get_config_manager
from yardrover.core.errors import ConfigValidationError, ConfigurationError
from yardrover.models.config import Configuration

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api", tags=["config"])


@router.get("/config")
async def get_config(
    context: SecurityContext = Depends(require_viewer),
) -> Configuration:
    """Get complete system configuration (viewer role or higher required).

    Returns:
        Current system configuration

    Raises:
        HTTPException: If configuration cannot be retrieved or authentication fails
    """
    try:
        config_manager = get_config_manager()
        logger.info("config_read", user=context.api_key_name, role=context.role.value)
        return config_manager.config
    except ConfigurationError as e:
        logger.error("failed_to_get_config", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=e.to_dict(),
        )


@router.post("/config", status_code=status.HTTP_200_OK)
async def replace_config(
    config: Configuration,
    context: SecurityContext = Depends(require_admin),
) -> dict[str, str]:
    """Replace entire system configuration (admin only).

    Args:
        config: New system configuration
        context: Security context (admin required)

    Returns:
        Success message

    Raises:
        HTTPException: If configuration is invalid or cannot be saved
    """
    try:
        config_manager = get_config_manager()
        config_manager.config = config
        await config_manager.save()
        logger.info("config_replaced", user=context.api_key_name, role=context.role.value)
        return {"message": "Configuration updated successfully"}
    except ValidationError as e:
        logger.warning("invalid_config", errors=e.errors())
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "ValidationError", "message": str(e)},
        )
    except ConfigurationError as e:
        logger.error("failed_to_save_config", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=e.to_dict(),
        )


@router.patch("/config", status_code=status.HTTP_200_OK)
async def update_config(
    updates: dict,
    context: SecurityContext = Depends(require_admin),
) -> dict[str, str]:
    """Update specific configuration fields (admin only).

    Args:
        updates: Dictionary of configuration updates
        context: Security context (admin required)

    Returns:
        Success message

    Raises:
        HTTPException: If updates are invalid or cannot be saved
    """
    try:
        config_manager = get_config_manager()

        # Apply updates to nested configuration
        for key, value in updates.items():
            if not hasattr(config_manager.config, key):
                raise ConfigValidationError(
                    f"Unknown configuration section: {key}",
                    details={"field": key},
                )

            # Get the current section
            section = getattr(config_manager.config, key)

            # Update section fields
            if isinstance(value, dict):
                for field, field_value in value.items():
                    if not hasattr(section, field):
                        raise ConfigValidationError(
                            f"Unknown configuration field: {key}.{field}",
                            details={"field": f"{key}.{field}"},
                        )
                    setattr(section, field, field_value)
            else:
                # Direct value assignment
                setattr(config_manager.config, key, value)

        # Validate updated configuration
        config_manager.config.model_validate(config_manager.config.model_dump())

        # Save configuration
        await config_manager.save()

        logger.info(
            "config_updated",
            fields=list(updates.keys()),
            user=context.api_key_name,
            role=context.role.value,
        )
        return {"message": "Configuration updated successfully"}

    except ConfigValidationError as e:
        logger.warning("invalid_config_update", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.to_dict(),
        )
    except ValidationError as e:
        logger.warning("config_validation_failed", errors=e.errors())
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "ValidationError", "message": str(e)},
        )
    except ConfigurationError as e:
        logger.error("failed_to_update_config", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=e.to_dict(),
        )

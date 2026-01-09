"""Setup API endpoints for first-boot configuration."""

import structlog
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from yardrover.auth import Role, get_api_key_manager, get_user_manager
from yardrover.core.config import get_config_manager

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/setup", tags=["setup"])


class SetupStatusResponse(BaseModel):
    """Setup status response."""

    setup_completed: bool = Field(description="Whether initial setup has been completed")
    has_admin_key: bool = Field(description="Whether an admin API key exists")
    device_name: str = Field(description="Current device name")
    in_setup_mode: bool = Field(description="Whether device is in setup mode")


class CompleteSetupRequest(BaseModel):
    """Complete setup request."""

    device_name: str = Field(min_length=1, max_length=128, description="Device name")

    # User account fields
    username: str = Field(min_length=1, max_length=64, description="Admin username")
    password: str = Field(min_length=8, max_length=128, description="Admin password (min 8 chars)")
    display_name: str | None = Field(default=None, max_length=128, description="Display name")
    pin: str | None = Field(
        default=None,
        min_length=4,
        max_length=6,
        pattern=r"^\d*$",
        description="Optional 4-6 digit PIN for consumer mode",
    )

    # API key fields (still create one for automation)
    admin_key_name: str = Field(
        default="Admin API Key",
        min_length=1,
        max_length=128,
        description="Name for the admin API key",
    )
    admin_key_description: str | None = Field(
        default="Admin API key created during setup for automation and CLI tools",
        max_length=256,
        description="Description for the admin key",
    )


class CompleteSetupResponse(BaseModel):
    """Complete setup response."""

    success: bool = Field(description="Whether setup was completed successfully")
    user_id: str = Field(description="Created user ID")
    username: str = Field(description="Created username")
    api_key: str = Field(description="Generated admin API key (shown only once!)")
    device_name: str = Field(description="Device name")
    message: str = Field(description="Success message")


@router.get("/status", response_model=SetupStatusResponse)
async def get_setup_status() -> SetupStatusResponse:
    """Get current setup status.

    This endpoint is always accessible (no authentication required)
    to allow checking if setup is needed.

    Returns:
        Setup status information
    """
    config_manager = get_config_manager()
    api_key_manager = get_api_key_manager()

    # Check if admin keys exist
    admin_keys = [
        key for key in api_key_manager.list_keys() if key.role == Role.ADMIN
    ]
    has_admin_key = len(admin_keys) > 0

    # Setup is incomplete if:
    # 1. setup_completed flag is False, OR
    # 2. No admin keys exist
    setup_completed = config_manager.config.security.setup_completed and has_admin_key
    in_setup_mode = not setup_completed

    logger.info(
        "setup_status_checked",
        setup_completed=setup_completed,
        has_admin_key=has_admin_key,
        in_setup_mode=in_setup_mode,
    )

    return SetupStatusResponse(
        setup_completed=setup_completed,
        has_admin_key=has_admin_key,
        device_name=config_manager.config.device.name,
        in_setup_mode=in_setup_mode,
    )


@router.post("/complete", response_model=CompleteSetupResponse)
async def complete_setup(request: CompleteSetupRequest) -> CompleteSetupResponse:
    """Complete initial setup and create admin API key.

    This endpoint is only accessible when setup is incomplete.
    Once setup is completed, this endpoint returns 403 Forbidden.

    Args:
        request: Setup completion request

    Returns:
        Setup completion response with admin API key

    Raises:
        HTTPException: If setup is already completed or fails
    """
    config_manager = get_config_manager()
    api_key_manager = get_api_key_manager()

    # Check if setup is already completed
    if config_manager.config.security.setup_completed:
        admin_keys = [
            key for key in api_key_manager.list_keys() if key.role == Role.ADMIN
        ]
        if len(admin_keys) > 0:
            logger.warning("setup_already_completed_attempt")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Setup has already been completed. Use /api/auth endpoints to manage API keys.",
            )

    try:
        # Update device name
        await config_manager.update({"device": {"name": request.device_name}})

        # Create admin user account
        user_manager = get_user_manager()
        try:
            user = user_manager.create_user(
                username=request.username,
                password=request.password,
                role=Role.ADMIN,
                display_name=request.display_name or request.username,
                pin=request.pin if request.pin else None,
            )
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User creation failed: {str(e)}",
            ) from e

        # Create admin API key for automation/CLI
        admin_key, plaintext_key = api_key_manager.create_key(
            name=request.admin_key_name,
            role=Role.ADMIN,
            description=request.admin_key_description,
        )

        # Mark setup as completed
        await config_manager.update({"security": {"setup_completed": True}})

        logger.info(
            "setup_completed",
            device_name=request.device_name,
            user_id=user.user_id,
            username=user.username,
            admin_key_id=admin_key.key_id,
            admin_key_name=admin_key.name,
            has_pin=user.hashed_pin is not None,
        )

        return CompleteSetupResponse(
            success=True,
            user_id=user.user_id,
            username=user.username,
            api_key=plaintext_key,
            device_name=request.device_name,
            message="Setup completed successfully! You can now log in with your username and password. "
            "The API key is for automation and CLI tools - save it securely as it will not be shown again.",
        )

    except Exception as e:
        logger.error(
            "setup_completion_failed",
            error=str(e),
            device_name=request.device_name,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Setup failed: {str(e)}",
        ) from e


@router.post("/reset")
async def reset_setup() -> dict[str, str]:
    """Reset setup mode (for testing or factory reset).

    WARNING: This endpoint is only available during development or
    when explicitly enabled. In production, this should require
    physical access to the device.

    Returns:
        Success message

    Raises:
        HTTPException: If reset is not allowed
    """
    config_manager = get_config_manager()

    # Only allow reset in development mode or if security is disabled
    if (
        not config_manager.settings.debug
        and config_manager.config.security.enabled
    ):
        logger.warning("setup_reset_forbidden_in_production")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Setup reset is only available in development mode. "
            "For production reset, physical access to device is required.",
        )

    # Clear setup completed flag
    await config_manager.update({"security": {"setup_completed": False}})

    # Clear all API keys
    api_key_manager = get_api_key_manager()
    for key in api_key_manager.list_keys():
        api_key_manager.delete_key(key.key_id)

    # Clear all users
    user_manager = get_user_manager()
    for user in user_manager.list_users():
        user_manager.delete_user(user.user_id)

    logger.warning("setup_reset", note="All API keys and users deleted, setup mode enabled")

    return {
        "message": "Setup has been reset. Device is now in setup mode.",
        "warning": "All API keys and user accounts have been deleted.",
    }

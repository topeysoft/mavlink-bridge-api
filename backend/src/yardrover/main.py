"""Main FastAPI application entry point."""

import asyncio
import secrets
from contextlib import asynccontextmanager
from typing import AsyncIterator, Optional

import structlog
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

# Import API routers
from yardrover.api import auth, config, health, mavlink, mdns, missions, peripherals, recording, resources, rtcm, setup, websocket, wifi, zones

# Import auth components
from yardrover.auth import Role, get_api_key_manager
from yardrover.auth.jwt_handler import initialize_jwt_handler
from yardrover.auth.refresh_tokens import initialize_refresh_token_store

# Import core components
from yardrover.core.config import ConfigManager, get_config_manager
from yardrover.core.errors import YardRoverError
from yardrover.core.events import EventBus, get_event_bus
from yardrover.core.health import HealthMonitor, get_health_monitor
from yardrover.core.logging import configure_logging
from yardrover.core.storage import Storage, get_storage
from yardrover.models.config import Settings

# Import network components
from yardrover.network import MDNSManager, WiFiManager
from yardrover.network.websocket import WebSocketManager

# Import MAVLink components
from yardrover.mavlink.router import DataRouter
from yardrover.models.mavlink import SerialConfig

# Import resource components
from yardrover.resources.storage import ResourceStorage

# Import RTCM components
from yardrover.rtcm.router import RTCMOutputRouter

# Import peripheral components
from yardrover.peripherals import PeripheralManager

# Configure logging before anything else
settings = Settings()
configure_logging(settings.log_level, settings.log_format)

logger = structlog.get_logger(__name__)


async def _session_cleanup_loop():
    """Background task to clean up old recording sessions every 5 minutes"""
    from yardrover.api.recording import get_session_manager

    while True:
        try:
            await asyncio.sleep(300)  # 5 minutes
            manager = get_session_manager()
            cleaned = manager.cleanup_old_sessions(max_age_seconds=3600)  # 1 hour
            if cleaned > 0:
                logger.info("recording_sessions_cleaned", count=cleaned)
        except Exception as e:
            logger.error("session_cleanup_error", error=str(e))


# Global instances (initialized in lifespan)
event_bus: Optional[EventBus] = None
config_manager: Optional[ConfigManager] = None
storage: Optional[Storage] = None
health_monitor: Optional[HealthMonitor] = None
wifi_manager: Optional[WiFiManager] = None
mdns_manager: Optional[MDNSManager] = None
ws_manager: Optional[WebSocketManager] = None
mavlink_router: Optional[DataRouter] = None
resource_storage: Optional[ResourceStorage] = None
rtcm_router: Optional[RTCMOutputRouter] = None
peripheral_manager: Optional[PeripheralManager] = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan manager.

    Handles startup and shutdown of background tasks and services.
    """
    global event_bus, config_manager, storage, health_monitor, wifi_manager, mdns_manager, ws_manager, mavlink_router, resource_storage, rtcm_router, peripheral_manager

    logger.info(
        "yardrover_starting",
        version="2.0.0",
        environment=settings.environment,
        debug=settings.debug,
        reload=settings.reload,
        log_level=settings.log_level,
        allow_anonymous_docs=settings.allow_anonymous_docs,
        rate_limit_enabled=settings.rate_limit_enabled,
    )

    # Initialize core services
    background_tasks = []

    try:
        # 1. Initialize event bus
        event_bus = get_event_bus()
        logger.info("event_bus_initialized")

        # 2. Load configuration
        config_manager = get_config_manager()
        config_manager.event_bus = event_bus
        await config_manager.load()
        logger.info(
            "config_loaded",
            device_name=config_manager.config.device.name,
            hostname=config_manager.config.device.hostname,
        )

        # 3. Initialize storage
        storage = get_storage(config_manager.config.storage.base_path)
        await storage.initialize()
        logger.info("storage_initialized", path=str(storage.base_path))

        # 4. Initialize authentication (if enabled)
        if config_manager.config.security.enabled:
            # Initialize JWT handler with secret from config or generate one
            jwt_secret = config_manager.config.security.jwt_secret
            if not jwt_secret:
                jwt_secret = secrets.token_urlsafe(32)
                logger.warning(
                    "jwt_secret_generated",
                    note="Using generated JWT secret. Set YARDROVER_JWT_SECRET for persistence.",
                )

            initialize_jwt_handler(
                secret_key=jwt_secret,
                algorithm=config_manager.config.security.jwt_algorithm,
                access_token_expire_minutes=config_manager.config.security.access_token_expire_minutes,
            )

            # Initialize refresh token store
            initialize_refresh_token_store()
            logger.info("refresh_token_store_initialized")

            # Check if setup is needed
            api_key_manager = get_api_key_manager()
            admin_keys = [
                key for key in api_key_manager.list_keys() if key.role == Role.ADMIN
            ]

            if not config_manager.config.security.setup_completed or not admin_keys:
                # Determine protocol and port for setup URL
                protocol = "https" if settings.tls_enabled else "http"
                port = settings.tls_port if settings.tls_enabled else settings.port

                logger.warning(
                    "first_boot_detected",
                    setup_completed=config_manager.config.security.setup_completed,
                    has_admin_keys=len(admin_keys) > 0,
                    note="Device is in SETUP MODE. Access the web interface to complete setup.",
                )
                logger.warning(
                    "setup_instructions",
                    web_url=f"{protocol}://{config_manager.config.device.hostname}.local:{port}",
                    note="Navigate to /setup to create your admin credentials",
                )
            else:
                logger.info(
                    "authentication_initialized",
                    security_enabled=True,
                    admin_keys_count=len(admin_keys),
                )
        else:
            logger.warning("authentication_disabled", note="All endpoints are publicly accessible")

        # 5. Initialize health monitor
        health_monitor = get_health_monitor()
        health_monitor.config_manager = config_manager
        health_monitor.storage = storage
        logger.info("health_monitor_initialized")

        # 6. Initialize network managers (optional on non-Pi systems)
        try:
            wifi_manager = WiFiManager(event_bus)
            await wifi_manager.start()
            logger.info("wifi_manager_initialized")
        except Exception as e:
            logger.warning(
                "wifi_manager_initialization_failed",
                error=str(e),
                note="WiFi features will be unavailable (requires NetworkManager)",
            )
            wifi_manager = None

        try:
            mdns_manager = MDNSManager(event_bus, config_manager.config.device.hostname)
            await mdns_manager.start()
            logger.info("mdns_manager_initialized")

            # Advertise HTTP/HTTPS API service
            if mdns_manager:
                # Use HTTPS service type if TLS is enabled
                service_type = "_https._tcp" if settings.tls_enabled else "_http._tcp"
                service_port = settings.tls_port if settings.tls_enabled else settings.port

                await mdns_manager.add_service(
                    service_name=config_manager.config.device.name,
                    service_type=service_type,
                    port=service_port,
                    txt_records={
                        "version": "2.0.0",
                        "device": "yardrover",
                        "api": "rest",
                        "tls": "true" if settings.tls_enabled else "false",
                    },
                )
        except Exception as e:
            logger.warning(
                "mdns_manager_initialization_failed",
                error=str(e),
                note="mDNS features will be unavailable",
            )
            mdns_manager = None

        # 6. Initialize WebSocket manager
        ws_manager = WebSocketManager(event_bus)
        await ws_manager.start()
        websocket.set_websocket_manager(ws_manager)
        logger.info("websocket_manager_initialized")

        # 7. Initialize MAVLink router (optional - requires serial port)
        try:
            # Get serial configuration from config
            serial_config = SerialConfig(
                port=config_manager.config.serial.port,
                baudrate=config_manager.config.serial.baudrate,
                timeout=config_manager.config.serial.timeout,
                auto_baud=True,
            )
            mavlink_router = DataRouter(serial_config, event_bus)
            mavlink.set_router(mavlink_router)

            # Try to auto-start the router
            try:
                if await mavlink_router.start():
                    logger.info(
                        "mavlink_router_started",
                        port=serial_config.port,
                        baudrate=serial_config.baudrate,
                    )
                else:
                    logger.warning(
                        "mavlink_router_start_failed",
                        port=serial_config.port,
                        note="Router initialized but not started (serial port may not be available)",
                    )
            except Exception as start_error:
                logger.warning(
                    "mavlink_router_start_error",
                    port=serial_config.port,
                    error=str(start_error),
                    note="Router initialized but not started",
                )
        except Exception as e:
            logger.warning(
                "mavlink_router_initialization_failed",
                error=str(e),
                note="MAVLink features will be unavailable (requires serial port)",
            )
            mavlink_router = None

        # 8. Initialize resource storage
        try:
            resource_base_path = str(config_manager.config.storage.base_path / "resources")
            resource_storage = ResourceStorage(
                base_path=resource_base_path,
                event_bus=event_bus,
            )
            await resource_storage.start()
            zones.set_storage(resource_storage)
            missions.set_storage(resource_storage)
            resources.set_storage(resource_storage)
            logger.info("resource_storage_initialized", path=resource_base_path)
        except Exception as e:
            logger.warning(
                "resource_storage_initialization_failed",
                error=str(e),
                note="Resource features will be unavailable",
            )
            resource_storage = None

        # 9. Initialize RTCM output router (client started via API)
        try:
            rtcm_router = RTCMOutputRouter(event_bus)
            rtcm.set_output_router(rtcm_router)
            logger.info("rtcm_router_initialized", note="RTCM client will be started via API")
        except Exception as e:
            logger.warning(
                "rtcm_router_initialization_failed",
                error=str(e),
                note="RTCM features will be unavailable",
            )
            rtcm_router = None

        # 10. Initialize peripheral manager
        try:
            peripheral_manager = PeripheralManager(event_bus)
            await peripheral_manager.start()
            peripherals.set_manager(peripheral_manager)
            logger.info("peripheral_manager_initialized")
        except Exception as e:
            logger.warning(
                "peripheral_manager_initialization_failed",
                error=str(e),
                note="Peripheral features will be unavailable",
            )
            peripheral_manager = None

        # 11. Store managers in app state for API dependencies
        app.state.wifi_manager = wifi_manager
        app.state.mdns_manager = mdns_manager
        app.state.ws_manager = ws_manager
        app.state.mavlink_router = mavlink_router
        app.state.resource_storage = resource_storage
        app.state.rtcm_router = rtcm_router
        app.state.peripheral_manager = peripheral_manager

        # 12. Start background tasks
        health_task = asyncio.create_task(health_monitor.run())
        background_tasks.append(health_task)

        # Recording session cleanup task
        cleanup_task = asyncio.create_task(_session_cleanup_loop())
        background_tasks.append(cleanup_task)

        logger.info("background_tasks_started", count=len(background_tasks))

        logger.info("yardrover_ready")

        yield

    finally:
        # Shutdown
        logger.info("yardrover_shutting_down")

        # Stop peripheral manager
        if peripheral_manager:
            await peripheral_manager.stop()
            logger.info("peripheral_manager_stopped")

        # Stop RTCM client and router
        if rtcm_router:
            # Stop any running NTRIP client
            from yardrover.api.rtcm import _ntrip_client
            if _ntrip_client:
                await _ntrip_client.stop()
            await rtcm_router.close()
            logger.info("rtcm_stopped")

        # Stop resource storage
        if resource_storage:
            await resource_storage.stop()
            logger.info("resource_storage_stopped")

        # Stop MAVLink router
        if mavlink_router:
            await mavlink_router.stop()
            logger.info("mavlink_router_stopped")

        # Stop WebSocket manager
        if ws_manager:
            await ws_manager.stop()
            logger.info("websocket_manager_stopped")

        # Stop network managers
        if mdns_manager:
            await mdns_manager.stop()
            logger.info("mdns_manager_stopped")

        if wifi_manager:
            await wifi_manager.stop()
            logger.info("wifi_manager_stopped")

        # Cancel all background tasks
        for task in background_tasks:
            task.cancel()

        # Wait for tasks to complete
        await asyncio.gather(*background_tasks, return_exceptions=True)

        logger.info("yardrover_shutdown_complete")


# Create FastAPI application
app = FastAPI(
    title="YardRover API",
    description="Autonomous utility machine control API",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.allow_anonymous_docs else None,
    redoc_url="/redoc" if settings.allow_anonymous_docs else None,
    openapi_url="/openapi.json",
)

# Initialize rate limiter
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{settings.rate_limit_requests}/minute"]
    if settings.rate_limit_enabled
    else [],
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware - use configured origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handlers
@app.exception_handler(YardRoverError)
async def yardrover_exception_handler(
    request: Request, exc: YardRoverError
) -> JSONResponse:
    """Handle YardRover custom exceptions.

    Args:
        request: The request that caused the exception
        exc: The YardRover exception

    Returns:
        JSON error response
    """
    # Determine log level based on HTTP status
    http_status_code = getattr(exc, "http_status", 500)
    if http_status_code >= 500:
        logger.error(
            "yardrover_error",
            error=exc.__class__.__name__,
            message=exc.message,
            code=exc.code,
            path=request.url.path,
            http_status=http_status_code,
        )
    else:
        logger.warning(
            "yardrover_error",
            error=exc.__class__.__name__,
            message=exc.message,
            code=exc.code,
            path=request.url.path,
            http_status=http_status_code,
        )

    return JSONResponse(
        status_code=http_status_code,
        content=exc.to_dict(),
    )


@app.exception_handler(Exception)
async def general_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    """Handle all unhandled exceptions.

    Args:
        request: The request that caused the exception
        exc: The exception

    Returns:
        JSON error response
    """
    logger.exception(
        "unhandled_exception",
        error=exc.__class__.__name__,
        path=request.url.path,
    )

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "InternalServerError",
            "message": "An unexpected error occurred",
            "code": "INTERNAL_ERROR",
            "details": {},
        },
    )


# Register API routers
app.include_router(setup.router)  # Setup endpoints (no auth required for initial setup)
app.include_router(auth.router)  # Auth endpoints (login, API key management)
app.include_router(health.router)  # Health check (allow anonymous by default)
app.include_router(config.router)
app.include_router(wifi.router)
app.include_router(mdns.router)
app.include_router(websocket.router)
app.include_router(mavlink.router)
app.include_router(zones.router)
app.include_router(recording.router)  # Zone recording endpoints
app.include_router(missions.router)
app.include_router(resources.router)
app.include_router(rtcm.router)
app.include_router(peripherals.router)


def run() -> None:
    """Run the application (CLI entry point)."""
    import uvicorn

    # Determine if TLS is enabled and configure accordingly
    if settings.tls_enabled:
        if not settings.tls_cert_file or not settings.tls_key_file:
            logger.error(
                "tls_configuration_error",
                message="TLS enabled but cert_file or key_file not provided",
            )
            raise ValueError("TLS enabled but cert_file or key_file not configured")

        # Use TLS port when TLS is enabled
        port = settings.tls_port

        logger.info(
            "starting_with_tls",
            host=settings.host,
            port=port,
            cert_file=str(settings.tls_cert_file),
        )

        uvicorn.run(
            "yardrover.main:app",
            host=settings.host,
            port=port,
            reload=settings.reload,
            log_level=settings.log_level.lower(),
            ssl_keyfile=str(settings.tls_key_file),
            ssl_certfile=str(settings.tls_cert_file),
            ssl_ca_certs=str(settings.tls_ca_certs) if settings.tls_ca_certs else None,
        )
    else:
        logger.info(
            "starting_without_tls",
            host=settings.host,
            port=settings.port,
            note="Running in HTTP mode (TLS disabled)",
        )

        uvicorn.run(
            "yardrover.main:app",
            host=settings.host,
            port=settings.port,
            reload=settings.reload,
            log_level=settings.log_level.lower(),
        )


if __name__ == "__main__":
    run()

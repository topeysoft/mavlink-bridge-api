"""
mDNS service management using zeroconf.

This module provides mDNS/Bonjour service advertisement and discovery
for network service discovery on local networks.
"""

import asyncio
from datetime import datetime, timedelta
from typing import Optional

import structlog
from zeroconf import IPVersion, ServiceInfo, Zeroconf
from zeroconf.asyncio import (
    AsyncServiceBrowser,
    AsyncServiceInfo,
    AsyncZeroconf,
    ServiceListener as AsyncServiceListener,
)

from ..core.errors import NetworkError
from ..core.events import EventBus
from ..models.network import (
    DiscoveredService,
    MDNSService,
    MDNSConfig,
)

logger = structlog.get_logger(__name__)


class ServiceListener(AsyncServiceListener):
    """Async listener for mDNS service discovery events."""

    def __init__(self, event_bus: EventBus, service_type: str):
        """
        Initialize service listener.

        Args:
            event_bus: Event bus for publishing discovery events
            service_type: Service type to listen for
        """
        self.event_bus = event_bus
        self.service_type = service_type
        self.discovered: dict[str, DiscoveredService] = {}

    async def async_add_service(
        self, zc: AsyncZeroconf, service_type: str, name: str
    ) -> None:
        """Handle service added event (async)."""
        try:
            info = AsyncServiceInfo(service_type, name)
            if await info.async_request(zc.zeroconf, 3000):
                # Convert to discovered service
                txt_records = {}
                if info.properties:
                    for key, value in info.properties.items():
                        try:
                            txt_records[key.decode("utf-8")] = value.decode("utf-8")
                        except:
                            pass

                # Get first IPv4 address
                ip_address = None
                for addr in info.addresses:
                    if len(addr) == 4:  # IPv4
                        ip_address = ".".join(str(b) for b in addr)
                        break

                if not ip_address:
                    return

                service = DiscoveredService(
                    hostname=info.server if info.server else name,
                    service_name=name,
                    service_type=service_type,
                    ip_address=ip_address,
                    port=info.port,
                    txt_records=txt_records,
                    last_seen=datetime.utcnow(),
                )

                self.discovered[name] = service

                # Publish discovery event
                await self.event_bus.emit(
                    "mdns.service_discovered",
                    {
                        "service_type": service_type,
                        "service_name": name,
                        "ip_address": ip_address,
                        "port": info.port,
                    },
                )

                logger.info(
                    "mdns_service_discovered",
                    service_type=service_type,
                    name=name,
                    ip=ip_address,
                    port=info.port,
                )

        except Exception as e:
            logger.error("mdns_add_service_error", name=name, error=str(e))

    async def async_remove_service(
        self, zc: AsyncZeroconf, service_type: str, name: str
    ) -> None:
        """Handle service removed event (async)."""
        if name in self.discovered:
            del self.discovered[name]

            await self.event_bus.emit(
                "mdns.service_removed",
                {
                    "service_type": service_type,
                    "service_name": name,
                },
            )

            logger.info(
                "mdns_service_removed",
                service_type=service_type,
                name=name,
            )

    async def async_update_service(
        self, zc: AsyncZeroconf, service_type: str, name: str
    ) -> None:
        """Handle service updated event (async)."""
        # Treat as add
        await self.async_add_service(zc, service_type, name)


class MDNSManager:
    """
    mDNS service manager using zeroconf.

    Provides service advertisement and discovery for local network
    service discovery using mDNS/Bonjour protocol.
    """

    SERVICE_TIMEOUT = 120  # seconds
    CLEANUP_INTERVAL = 30  # seconds

    def __init__(self, event_bus: EventBus, hostname: str):
        """
        Initialize mDNS manager.

        Args:
            event_bus: Event bus for publishing mDNS events
            hostname: Device hostname for service advertisement
        """
        self.event_bus = event_bus
        self._hostname = hostname
        self._enabled = True
        self._azc: Optional[AsyncZeroconf] = None
        self._advertised_services: dict[str, ServiceInfo] = {}
        self._listeners: dict[str, tuple[ServiceListener, AsyncServiceBrowser]] = {}
        self._cleanup_task: Optional[asyncio.Task] = None

        logger.info("mdns_manager_initialized", hostname=hostname)

    async def start(self) -> None:
        """Start mDNS service."""
        if not self._enabled:
            logger.info("mdns_disabled")
            return

        logger.info("mdns_starting", hostname=self._hostname)

        try:
            # Initialize AsyncZeroconf
            self._azc = AsyncZeroconf(ip_version=IPVersion.V4Only)

            # Start cleanup task
            self._cleanup_task = asyncio.create_task(self._cleanup_expired_services())

            logger.info("mdns_started", hostname=self._hostname)

        except Exception as e:
            logger.exception("mdns_start_exception")
            raise NetworkError(f"Failed to start mDNS: {str(e)}")

    async def stop(self) -> None:
        """Stop mDNS service and cleanup."""
        logger.info("mdns_stopping")

        # Cancel cleanup task
        if self._cleanup_task and not self._cleanup_task.done():
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass

        # Stop all browsers
        for listener, browser in self._listeners.values():
            await browser.async_cancel()

        self._listeners.clear()

        # Unregister all services
        if self._azc:
            for service_info in self._advertised_services.values():
                try:
                    await self._azc.async_unregister_service(service_info)
                except Exception as e:
                    logger.warning(
                        "mdns_unregister_service_exception",
                        service=service_info.name,
                        error=str(e),
                    )

        self._advertised_services.clear()

        # Close zeroconf
        if self._azc:
            await self._azc.async_close()
            self._azc = None

        logger.info("mdns_stopped")

    async def add_service(
        self,
        service_name: str,
        service_type: str,
        port: int,
        txt_records: Optional[dict[str, str]] = None,
    ) -> bool:
        """
        Advertise an mDNS service.

        Args:
            service_name: Service instance name
            service_type: Service type (e.g., '_http._tcp.local.')
            port: Service port
            txt_records: Optional TXT record key-value pairs

        Returns:
            True if service was advertised

        Raises:
            NetworkError: If mDNS is not started or service registration fails
        """
        if not self._azc:
            raise NetworkError("mDNS not started")

        logger.info(
            "mdns_add_service",
            service_name=service_name,
            service_type=service_type,
            port=port,
        )

        try:
            # Ensure service type ends with .local.
            if not service_type.endswith(".local."):
                service_type = f"{service_type}.local."

            # Build full service name
            full_name = f"{service_name}.{service_type}"

            # Prepare TXT records
            properties = {}
            if txt_records:
                for key, value in txt_records.items():
                    properties[key.encode("utf-8")] = value.encode("utf-8")

            # Create service info
            # Get local IP addresses
            zc = self._azc.zeroconf
            addresses = []

            # Try to get IPv4 addresses from interfaces
            import socket

            hostname = socket.gethostname()
            try:
                addr_info = socket.getaddrinfo(hostname, None)
                for info in addr_info:
                    if info[0] == socket.AF_INET:  # IPv4
                        ip_str = info[4][0]
                        addresses.append(socket.inet_aton(ip_str))
            except Exception:
                # Fallback to localhost
                addresses = [socket.inet_aton("127.0.0.1")]

            info = ServiceInfo(
                service_type,
                full_name,
                port=port,
                properties=properties,
                server=f"{self._hostname}.local.",
                addresses=addresses,
            )

            # Register service
            await self._azc.async_register_service(info)

            # Store service info
            service_key = f"{service_type}:{port}"
            self._advertised_services[service_key] = info

            # Publish event
            await self.event_bus.emit(
                "mdns.service_advertised",
                {
                    "service_name": service_name,
                    "service_type": service_type,
                    "port": port,
                },
            )

            logger.info(
                "mdns_service_advertised",
                service_name=service_name,
                service_type=service_type,
                port=port,
            )

            return True

        except Exception as e:
            logger.exception(
                "mdns_add_service_exception",
                service_name=service_name,
                service_type=service_type,
            )
            raise NetworkError(f"Failed to advertise service: {str(e)}")

    async def remove_service(self, service_type: str, port: int) -> bool:
        """
        Stop advertising an mDNS service.

        Args:
            service_type: Service type
            port: Service port

        Returns:
            True if service was removed
        """
        if not self._azc:
            return False

        service_key = f"{service_type}:{port}"
        service_info = self._advertised_services.get(service_key)

        if not service_info:
            logger.warning(
                "mdns_service_not_found",
                service_type=service_type,
                port=port,
            )
            return False

        logger.info(
            "mdns_remove_service",
            service_type=service_type,
            port=port,
        )

        try:
            await self._azc.async_unregister_service(service_info)
            del self._advertised_services[service_key]

            await self.event_bus.emit(
                "mdns.service_removed",
                {
                    "service_type": service_type,
                    "port": port,
                },
            )

            logger.info(
                "mdns_service_removed",
                service_type=service_type,
                port=port,
            )

            return True

        except Exception as e:
            logger.exception(
                "mdns_remove_service_exception",
                service_type=service_type,
                port=port,
            )
            return False

    async def discover(
        self, service_type: str, timeout: int = 5
    ) -> list[DiscoveredService]:
        """
        Discover mDNS services on the network.

        Args:
            service_type: Service type to discover (e.g., '_http._tcp.local.')
            timeout: Discovery timeout in seconds

        Returns:
            List of discovered services
        """
        if not self._azc:
            raise NetworkError("mDNS not started")

        logger.info("mdns_discover", service_type=service_type, timeout=timeout)

        # Ensure service type ends with .local.
        if not service_type.endswith(".local."):
            service_type = f"{service_type}.local."

        # Check if we already have a browser for this service type
        if service_type in self._listeners:
            listener, _ = self._listeners[service_type]
            # Return current discoveries
            return list(listener.discovered.values())

        try:
            # Create listener
            listener = ServiceListener(self.event_bus, service_type)

            # Create browser with the listener parameter (not handlers)
            browser = AsyncServiceBrowser(
                self._azc.zeroconf,
                service_type,
                listener=listener,
            )

            # Store listener and browser
            self._listeners[service_type] = (listener, browser)

            # Wait for discovery
            await asyncio.sleep(timeout)

            # Return discovered services
            services = list(listener.discovered.values())

            logger.info(
                "mdns_discover_complete",
                service_type=service_type,
                count=len(services),
            )

            return services

        except Exception as e:
            logger.exception("mdns_discover_exception", service_type=service_type)
            raise NetworkError(f"Failed to discover services: {str(e)}")

    def get_advertised_services(self) -> list[MDNSService]:
        """
        Get list of advertised services.

        Returns:
            List of advertised services
        """
        services = []

        for service_info in self._advertised_services.values():
            # Parse service type and name
            service_type = service_info.type
            full_name = service_info.name
            service_name = full_name.split(".")[0]

            # Parse TXT records
            txt_records = {}
            if service_info.properties:
                for key, value in service_info.properties.items():
                    try:
                        txt_records[key.decode("utf-8")] = value.decode("utf-8")
                    except:
                        pass

            services.append(
                MDNSService(
                    service_name=service_name,
                    service_type=service_type,
                    port=service_info.port,
                    hostname=service_info.server,
                    txt_records=txt_records,
                )
            )

        return services

    def get_discovered_services(
        self, service_type: Optional[str] = None
    ) -> list[DiscoveredService]:
        """
        Get list of discovered services.

        Args:
            service_type: Optional filter by service type

        Returns:
            List of discovered services
        """
        services = []

        for listener_service_type, (listener, _) in self._listeners.items():
            if service_type and service_type != listener_service_type:
                continue

            services.extend(listener.discovered.values())

        return services

    def get_config(self) -> MDNSConfig:
        """
        Get mDNS configuration.

        Returns:
            Current mDNS configuration
        """
        return MDNSConfig(
            enabled=self._enabled,
            hostname=self._hostname,
        )

    async def set_config(self, config: MDNSConfig) -> None:
        """
        Update mDNS configuration.

        Args:
            config: New mDNS configuration
        """
        was_enabled = self._enabled
        self._enabled = config.enabled
        self._hostname = config.hostname

        # Restart if enabled state changed
        if was_enabled != self._enabled:
            if self._enabled:
                await self.start()
            else:
                await self.stop()

        logger.info("mdns_config_updated", enabled=self._enabled, hostname=self._hostname)

    async def _cleanup_expired_services(self) -> None:
        """Background task to cleanup expired discovered services."""
        while True:
            try:
                await asyncio.sleep(self.CLEANUP_INTERVAL)

                now = datetime.utcnow()
                timeout_delta = timedelta(seconds=self.SERVICE_TIMEOUT)

                for listener, _ in self._listeners.values():
                    expired = []
                    for name, service in listener.discovered.items():
                        if now - service.last_seen > timeout_delta:
                            expired.append(name)

                    for name in expired:
                        del listener.discovered[name]
                        logger.info(
                            "mdns_service_expired",
                            service_name=name,
                        )

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.exception("mdns_cleanup_exception")
                await asyncio.sleep(5)  # Back off on error

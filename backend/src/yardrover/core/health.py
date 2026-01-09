"""System health monitoring using psutil."""

import asyncio
import platform
import socket
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

import psutil
import structlog

from yardrover.core.config import ConfigManager
from yardrover.core.storage import Storage
from yardrover.models.health import (
    DeviceInfo,
    HealthResponse,
    MAVLinkHealth,
    NetworkInfo,
    StorageHealth,
    SystemMetrics,
)

logger = structlog.get_logger(__name__)


class HealthMonitor:
    """System health monitoring.

    Replaces C++ HealthMonitor using psutil for system metrics.
    Provides comprehensive system status information.
    """

    def __init__(
        self,
        config_manager: Optional[ConfigManager] = None,
        storage: Optional[Storage] = None,
    ) -> None:
        """Initialize health monitor.

        Args:
            config_manager: Configuration manager instance
            storage: Storage instance
        """
        self.config_manager = config_manager
        self.storage = storage
        self._start_time = time.time()
        self._mavlink_healthy = False
        self._mavlink_connected = False
        self._mavlink_messages_received = 0
        self._mavlink_messages_sent = 0
        self._mavlink_last_message_time: Optional[datetime] = None

    def get_uptime(self) -> int:
        """Get system uptime in seconds.

        Returns:
            Uptime in seconds
        """
        return int(time.time() - self._start_time)

    def get_device_info(self) -> DeviceInfo:
        """Get device information.

        Returns:
            Device information model
        """
        uname = platform.uname()

        # Use configured hostname if available, otherwise fall back to system hostname
        hostname = (
            self.config_manager.config.device.hostname
            if self.config_manager
            else socket.gethostname()
        )

        return DeviceInfo(
            hostname=hostname,
            name=self.config_manager.config.device.name if self.config_manager else "YardRover",
            chipModel=uname.processor or uname.machine,
            chipRevision=0,  # Not applicable for Pi
            flashSize=self._get_disk_total(),
            sdkVersion=uname.release,
            coreCount=psutil.cpu_count(logical=False) or 1,
        )

    def get_network_info(self) -> NetworkInfo:
        """Get network information.

        Returns:
            Network information model
        """
        # Get primary network interface
        addrs = psutil.net_if_addrs()
        stats = psutil.net_if_stats()

        ip_address = "0.0.0.0"
        mac_address = "00:00:00:00:00:00"
        connected = False

        # Try to find active interface with IP
        for iface_name, iface_addrs in addrs.items():
            if iface_name == "lo":
                continue

            # Check if interface is up
            if iface_name in stats and stats[iface_name].isup:
                for addr in iface_addrs:
                    if addr.family == socket.AF_INET:
                        ip_address = addr.address
                        connected = True
                    elif addr.family == psutil.AF_LINK:
                        mac_address = addr.address

                if connected:
                    break

        return NetworkInfo(
            ipAddress=ip_address,
            macAddress=mac_address,
            connected=connected,
            ssid=None,  # Would need NetworkManager integration
            rssi=None,
        )

    def get_system_metrics(self) -> SystemMetrics:
        """Get system metrics.

        Returns:
            System metrics model
        """
        # CPU usage (1 second average)
        cpu_percent = psutil.cpu_percent(interval=0.1)

        # Memory info
        memory = psutil.virtual_memory()

        # Disk info
        disk = psutil.disk_usage("/")

        # Temperature (try to get CPU temp)
        temperature = self._get_cpu_temperature()

        return SystemMetrics(
            cpuUsage=cpu_percent,
            memoryUsed=memory.used,
            memoryTotal=memory.total,
            memoryPercent=memory.percent,
            diskUsed=disk.used,
            diskTotal=disk.total,
            diskPercent=disk.percent,
            temperature=temperature,
        )

    async def get_storage_health(self) -> Optional[StorageHealth]:
        """Get storage health status.

        Returns:
            Storage health model or None if storage not available
        """
        if not self.storage:
            return None

        try:
            total_size = await self.storage.get_size()
            # Get available space from disk usage
            disk = psutil.disk_usage(str(self.storage.base_path))

            return StorageHealth(
                healthy=True,
                totalSize=total_size,
                availableSize=disk.free,
            )
        except Exception as e:
            logger.warning("storage_health_check_failed", error=str(e))
            return StorageHealth(
                healthy=False,
                totalSize=0,
                availableSize=0,
                error=str(e),
            )

    def get_mavlink_health(self) -> MAVLinkHealth:
        """Get MAVLink health status.

        Returns:
            MAVLink health model
        """
        return MAVLinkHealth(
            healthy=self._mavlink_healthy,
            connected=self._mavlink_connected,
            messagesReceived=self._mavlink_messages_received,
            messagesSent=self._mavlink_messages_sent,
            lastMessageTime=self._mavlink_last_message_time,
        )

    async def get_health(self) -> HealthResponse:
        """Get complete health status.

        Returns:
            Complete health response
        """
        device_info = self.get_device_info()
        network_info = self.get_network_info()
        system_metrics = self.get_system_metrics()
        storage_health = await self.get_storage_health()
        mavlink_health = self.get_mavlink_health()

        # Determine overall status
        status = "healthy"

        if storage_health and not storage_health.healthy:
            status = "degraded"

        if not network_info.connected or system_metrics.cpu_usage > 90:
            status = "degraded"

        if system_metrics.memory_percent > 95 or system_metrics.disk_percent > 95:
            status = "unhealthy"

        return HealthResponse(
            status=status,
            uptime=self.get_uptime(),
            freeHeap=psutil.virtual_memory().available,
            device=device_info,
            network=network_info,
            system=system_metrics,
            storage=storage_health,
            mavlink=mavlink_health,
            timestamp=datetime.now(),
        )

    def update_mavlink_stats(
        self,
        connected: bool,
        messages_received: int = 0,
        messages_sent: int = 0,
    ) -> None:
        """Update MAVLink statistics.

        Args:
            connected: Whether MAVLink is connected
            messages_received: Messages received count increment
            messages_sent: Messages sent count increment
        """
        self._mavlink_connected = connected
        self._mavlink_healthy = connected
        self._mavlink_messages_received += messages_received
        self._mavlink_messages_sent += messages_sent

        if messages_received > 0 or messages_sent > 0:
            self._mavlink_last_message_time = datetime.now()

    def _get_cpu_temperature(self) -> Optional[float]:
        """Get CPU temperature in Celsius.

        Returns:
            CPU temperature or None if not available
        """
        try:
            # Try to read from Raspberry Pi thermal zone
            thermal_file = Path("/sys/class/thermal/thermal_zone0/temp")
            if thermal_file.exists():
                with open(thermal_file) as f:
                    temp = float(f.read().strip())
                    return temp / 1000.0  # Convert from millidegrees

            # Try psutil sensors (may not work on all systems)
            temps = psutil.sensors_temperatures()
            if temps:
                # Get first available temperature
                for name, entries in temps.items():
                    if entries:
                        return entries[0].current

        except Exception:
            pass

        return None

    def _get_disk_total(self) -> int:
        """Get total disk size in bytes.

        Returns:
            Total disk size
        """
        try:
            disk = psutil.disk_usage("/")
            return disk.total
        except Exception:
            return 0

    async def run(self) -> None:
        """Background task for periodic health monitoring.

        This can be used to log health status periodically or trigger alerts.
        """
        while True:
            try:
                health = await self.get_health()
                logger.debug(
                    "health_check",
                    status=health.status,
                    uptime=health.uptime,
                    cpu=health.system.cpu_usage,
                    memory=health.system.memory_percent,
                )

                # Log warning if degraded
                if health.status != "healthy":
                    logger.warning(
                        "system_health_degraded",
                        status=health.status,
                        cpu=health.system.cpu_usage,
                        memory=health.system.memory_percent,
                        disk=health.system.disk_percent,
                    )

            except Exception:
                logger.exception("health_check_error")

            # Check every 30 seconds
            await asyncio.sleep(30)


# Global health monitor instance
_health_monitor: Optional[HealthMonitor] = None


def get_health_monitor() -> HealthMonitor:
    """Get global health monitor instance.

    Returns:
        Global HealthMonitor instance
    """
    global _health_monitor
    if _health_monitor is None:
        _health_monitor = HealthMonitor()
    return _health_monitor

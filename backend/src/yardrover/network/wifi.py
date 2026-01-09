"""
WiFi management for Raspberry Pi using NetworkManager.

This module provides WiFi connectivity management through NetworkManager (nmcli),
offering functionality similar to the ESP32 WiFiManager but adapted for Linux.
"""

import asyncio
import re
import subprocess
from typing import Optional

import structlog

from ..core.errors import NetworkError
from ..core.events import EventBus
from ..models.network import (
    WiFiAuthMode,
    WiFiConnectionInfo,
    WiFiCredentials,
    WiFiNetwork,
    WiFiState,
    WiFiStatus,
)

logger = structlog.get_logger(__name__)


class WiFiManager:
    """
    WiFi management using NetworkManager/nmcli.

    Provides WiFi scanning, connection management, and status monitoring
    for Raspberry Pi deployment using NetworkManager.
    """

    # Connection timeouts and retries
    CONNECTION_TIMEOUT = 30  # seconds
    MAX_RECONNECT_ATTEMPTS = 6
    SIGNAL_CHECK_INTERVAL = 30  # seconds

    def __init__(self, event_bus: EventBus):
        """
        Initialize WiFi manager.

        Args:
            event_bus: Event bus for publishing WiFi events
        """
        self.event_bus = event_bus
        self._state = WiFiState.DISCONNECTED
        self._previous_state = WiFiState.DISCONNECTED
        self._reconnect_attempts = 0
        self._signal_check_task: Optional[asyncio.Task] = None
        self._connection_monitor_task: Optional[asyncio.Task] = None

        logger.info("wifi_manager_initialized")

    async def start(self) -> None:
        """Start WiFi manager and monitoring tasks."""
        logger.info("wifi_manager_starting")

        # Check if NetworkManager is available
        if not await self._check_nm_available():
            logger.error("networkmanager_not_available")
            raise NetworkError(
                "NetworkManager not available. Install with: sudo apt install network-manager"
            )

        # Update initial state
        await self._update_state()

        # Start background monitoring tasks
        self._connection_monitor_task = asyncio.create_task(
            self._monitor_connection()
        )

        logger.info("wifi_manager_started", state=self._state.value)

    async def stop(self) -> None:
        """Stop WiFi manager and cleanup tasks."""
        logger.info("wifi_manager_stopping")

        # Cancel background tasks
        if self._signal_check_task and not self._signal_check_task.done():
            self._signal_check_task.cancel()
            try:
                await self._signal_check_task
            except asyncio.CancelledError:
                pass

        if self._connection_monitor_task and not self._connection_monitor_task.done():
            self._connection_monitor_task.cancel()
            try:
                await self._connection_monitor_task
            except asyncio.CancelledError:
                pass

        logger.info("wifi_manager_stopped")

    async def connect(
        self, credentials: WiFiCredentials, save: bool = True
    ) -> WiFiState:
        """
        Connect to a WiFi network.

        Args:
            credentials: WiFi network credentials
            save: Whether to save the connection for auto-connect

        Returns:
            New WiFi state

        Raises:
            NetworkError: If connection fails
        """
        logger.info(
            "wifi_connect_attempt",
            ssid=credentials.ssid,
            save=save,
        )

        try:
            # Set state to connecting
            await self._set_state(WiFiState.CONNECTING)

            # Build nmcli command
            cmd = [
                "nmcli",
                "device",
                "wifi",
                "connect",
                credentials.ssid,
            ]

            if credentials.password:
                cmd.extend(["password", credentials.password])

            # Execute connection
            result = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            try:
                stdout, stderr = await asyncio.wait_for(
                    result.communicate(), timeout=self.CONNECTION_TIMEOUT
                )
            except asyncio.TimeoutError:
                logger.error(
                    "wifi_connect_timeout",
                    ssid=credentials.ssid,
                )
                await self._set_state(WiFiState.ERROR)
                raise NetworkError(f"Connection to {credentials.ssid} timed out")

            if result.returncode != 0:
                error_msg = stderr.decode().strip()
                logger.error(
                    "wifi_connect_failed",
                    ssid=credentials.ssid,
                    error=error_msg,
                )
                await self._set_state(WiFiState.ERROR)
                raise NetworkError(f"Failed to connect: {error_msg}")

            # Update state
            await self._update_state()

            # Publish connection event
            await self.event_bus.emit(
                "wifi.connected",
                {"ssid": credentials.ssid, "state": self._state.value},
            )

            logger.info(
                "wifi_connected",
                ssid=credentials.ssid,
                state=self._state.value,
            )

            self._reconnect_attempts = 0
            return self._state

        except Exception as e:
            logger.exception("wifi_connect_exception", ssid=credentials.ssid)
            await self._set_state(WiFiState.ERROR)
            raise

    async def disconnect(self) -> None:
        """Disconnect from current WiFi network."""
        logger.info("wifi_disconnect_attempt")

        try:
            # Get active WiFi connection
            connection = await self._get_active_wifi_connection()
            if not connection:
                logger.info("wifi_no_active_connection")
                await self._set_state(WiFiState.DISCONNECTED)
                return

            # Disconnect
            result = await asyncio.create_subprocess_exec(
                "nmcli",
                "connection",
                "down",
                connection,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            await result.communicate()

            # Update state
            await self._set_state(WiFiState.DISCONNECTED)

            # Publish disconnect event
            await self.event_bus.emit(
                "wifi.disconnected",
                {"state": self._state.value},
            )

            logger.info("wifi_disconnected")

        except Exception as e:
            logger.exception("wifi_disconnect_exception")
            raise NetworkError(f"Failed to disconnect: {str(e)}")

    async def scan(self, force: bool = False) -> list[WiFiNetwork]:
        """
        Scan for available WiFi networks.

        Args:
            force: Force a new scan (default: use cached results)

        Returns:
            List of discovered WiFi networks

        Raises:
            NetworkError: If scan fails
        """
        logger.info("wifi_scan_attempt", force=force)

        try:
            # Optionally request a new scan
            if force:
                await asyncio.create_subprocess_exec(
                    "nmcli",
                    "device",
                    "wifi",
                    "rescan",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                # Wait a bit for scan to complete
                await asyncio.sleep(2)

            # Get scan results
            result = await asyncio.create_subprocess_exec(
                "nmcli",
                "-t",
                "-f",
                "SSID,SIGNAL,SECURITY,CHAN,BSSID",
                "device",
                "wifi",
                "list",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout, stderr = await result.communicate()

            if result.returncode != 0:
                error_msg = stderr.decode().strip()
                logger.error("wifi_scan_failed", error=error_msg)
                raise NetworkError(f"WiFi scan failed: {error_msg}")

            # Parse results
            networks = []
            seen_ssids = set()

            for line in stdout.decode().strip().split("\n"):
                if not line:
                    continue

                parts = line.split(":")
                if len(parts) < 4:
                    continue

                ssid = parts[0].strip()
                if not ssid or ssid in seen_ssids:
                    continue

                seen_ssids.add(ssid)

                try:
                    signal = int(parts[1]) if parts[1] else 0
                    # Convert percentage to dBm (approximate)
                    rssi = -100 + (signal * 50 // 100)

                    security = parts[2].strip()
                    channel = int(parts[3]) if parts[3] and parts[3].isdigit() else 1
                    bssid = parts[4].strip() if len(parts) > 4 else None

                    auth_mode = self._parse_auth_mode(security)

                    networks.append(
                        WiFiNetwork(
                            ssid=ssid,
                            rssi=rssi,
                            auth_mode=auth_mode,
                            channel=channel,
                            bssid=bssid,
                        )
                    )
                except (ValueError, IndexError) as e:
                    logger.warning("wifi_scan_parse_error", line=line, error=str(e))
                    continue

            logger.info("wifi_scan_complete", network_count=len(networks))
            return networks

        except Exception as e:
            logger.exception("wifi_scan_exception")
            raise NetworkError(f"WiFi scan failed: {str(e)}")

    async def get_status(self) -> WiFiStatus:
        """
        Get current WiFi status.

        Returns:
            Current WiFi connection status
        """
        await self._update_state()

        connection_info = None
        saved_network = None

        if self._state == WiFiState.CONNECTED:
            connection_info = await self._get_connection_info()

        # Get saved connection
        saved_network = await self._get_saved_network()

        return WiFiStatus(
            state=self._state,
            connection_info=connection_info,
            saved_network=saved_network,
            ap_mode_active=False,  # AP mode not supported on Pi
            ap_ssid=None,
            ap_ip=None,
        )

    async def save_network(self, ssid: str) -> bool:
        """
        Save network credentials for auto-connect.

        This is handled automatically by NetworkManager when connecting.
        This method exists for API compatibility.

        Args:
            ssid: Network SSID to save

        Returns:
            True if network is saved
        """
        # NetworkManager automatically saves connections, so we just verify it exists
        connections = await self._get_saved_connections()
        return ssid in connections

    async def clear_saved_network(self, ssid: str) -> bool:
        """
        Clear saved network credentials.

        Args:
            ssid: Network SSID to remove

        Returns:
            True if network was removed
        """
        logger.info("wifi_clear_saved_network", ssid=ssid)

        try:
            result = await asyncio.create_subprocess_exec(
                "nmcli",
                "connection",
                "delete",
                ssid,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout, stderr = await result.communicate()

            if result.returncode != 0:
                error_msg = stderr.decode().strip()
                logger.warning("wifi_clear_network_failed", ssid=ssid, error=error_msg)
                return False

            logger.info("wifi_network_cleared", ssid=ssid)
            return True

        except Exception as e:
            logger.exception("wifi_clear_network_exception", ssid=ssid)
            return False

    # ========================================================================
    # Private Methods
    # ========================================================================

    async def _check_nm_available(self) -> bool:
        """Check if NetworkManager is available."""
        try:
            result = await asyncio.create_subprocess_exec(
                "which",
                "nmcli",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await result.communicate()
            return result.returncode == 0
        except Exception:
            return False

    async def _update_state(self) -> None:
        """Update current WiFi state from NetworkManager."""
        try:
            # Get WiFi device state
            result = await asyncio.create_subprocess_exec(
                "nmcli",
                "-t",
                "-f",
                "STATE",
                "device",
                "status",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout, _ = await result.communicate()
            lines = stdout.decode().strip().split("\n")

            # Check if we have a connected WiFi device
            is_connected = any("connected" in line.lower() for line in lines)

            if is_connected:
                await self._set_state(WiFiState.CONNECTED)
            else:
                await self._set_state(WiFiState.DISCONNECTED)

        except Exception as e:
            logger.exception("wifi_state_update_exception")
            await self._set_state(WiFiState.ERROR)

    async def _set_state(self, new_state: WiFiState) -> None:
        """Set WiFi state and publish event if changed."""
        if new_state != self._state:
            self._previous_state = self._state
            self._state = new_state

            await self.event_bus.emit(
                "wifi.state_changed",
                {
                    "state": self._state.value,
                    "previous_state": self._previous_state.value,
                },
            )

            logger.info(
                "wifi_state_changed",
                state=self._state.value,
                previous=self._previous_state.value,
            )

    async def _get_connection_info(self) -> Optional[WiFiConnectionInfo]:
        """Get current WiFi connection information."""
        try:
            # Get connection details
            result = await asyncio.create_subprocess_exec(
                "nmcli",
                "-t",
                "-f",
                "GENERAL.CONNECTION,IP4.ADDRESS,IP4.GATEWAY,GENERAL.DEVICE",
                "device",
                "show",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout, _ = await result.communicate()
            if result.returncode != 0:
                return None

            # Parse output
            data = {}
            for line in stdout.decode().strip().split("\n"):
                if ":" in line:
                    key, value = line.split(":", 1)
                    data[key.strip()] = value.strip()

            ssid = data.get("GENERAL.CONNECTION", "Unknown")

            # Get IP address without CIDR
            ip_address = data.get("IP4.ADDRESS", "0.0.0.0")
            if "/" in ip_address:
                ip_address = ip_address.split("/")[0]

            gateway = data.get("IP4.GATEWAY", "0.0.0.0")

            # Get signal strength and BSSID
            device = data.get("GENERAL.DEVICE", "wlan0")
            result = await asyncio.create_subprocess_exec(
                "nmcli",
                "-t",
                "-f",
                "BSSID,SIGNAL",
                "device",
                "wifi",
                "list",
                "ifname",
                device,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout, _ = await result.communicate()
            bssid = "00:00:00:00:00:00"
            rssi = -100

            if stdout:
                first_line = stdout.decode().strip().split("\n")[0]
                parts = first_line.split(":")
                if len(parts) >= 2:
                    bssid = parts[0].strip()
                    signal = int(parts[1]) if parts[1].isdigit() else 0
                    rssi = -100 + (signal * 50 // 100)

            return WiFiConnectionInfo(
                ssid=ssid,
                bssid=bssid,
                rssi=rssi,
                ip_address=ip_address,
                gateway=gateway,
                subnet_mask="255.255.255.0",  # Default, would need parsing
            )

        except Exception as e:
            logger.exception("wifi_get_connection_info_exception")
            return None

    async def _get_active_wifi_connection(self) -> Optional[str]:
        """Get the name of the active WiFi connection."""
        try:
            result = await asyncio.create_subprocess_exec(
                "nmcli",
                "-t",
                "-f",
                "NAME,TYPE,DEVICE",
                "connection",
                "show",
                "--active",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout, _ = await result.communicate()

            for line in stdout.decode().strip().split("\n"):
                parts = line.split(":")
                if len(parts) >= 3 and "802-11-wireless" in parts[1]:
                    return parts[0]  # Connection name

            return None

        except Exception as e:
            logger.exception("wifi_get_active_connection_exception")
            return None

    async def _get_saved_network(self) -> Optional[str]:
        """Get saved network SSID."""
        connections = await self._get_saved_connections()
        return connections[0] if connections else None

    async def _get_saved_connections(self) -> list[str]:
        """Get list of saved WiFi connection names."""
        try:
            result = await asyncio.create_subprocess_exec(
                "nmcli",
                "-t",
                "-f",
                "NAME,TYPE",
                "connection",
                "show",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout, _ = await result.communicate()

            connections = []
            for line in stdout.decode().strip().split("\n"):
                parts = line.split(":")
                if len(parts) >= 2 and "802-11-wireless" in parts[1]:
                    connections.append(parts[0])

            return connections

        except Exception as e:
            logger.exception("wifi_get_saved_connections_exception")
            return []

    def _parse_auth_mode(self, security: str) -> WiFiAuthMode:
        """Parse authentication mode from nmcli security string."""
        security_lower = security.lower()

        if not security or security_lower == "--":
            return WiFiAuthMode.OPEN
        elif "wpa3" in security_lower and "wpa2" in security_lower:
            return WiFiAuthMode.WPA2_WPA3_PSK
        elif "wpa3" in security_lower:
            return WiFiAuthMode.WPA3_PSK
        elif "wpa2" in security_lower and "wpa" in security_lower:
            return WiFiAuthMode.WPA_WPA2_PSK
        elif "wpa2" in security_lower:
            if "enterprise" in security_lower or "802.1x" in security_lower:
                return WiFiAuthMode.WPA2_ENTERPRISE
            return WiFiAuthMode.WPA2_PSK
        elif "wpa" in security_lower:
            return WiFiAuthMode.WPA_PSK
        elif "wep" in security_lower:
            return WiFiAuthMode.WEP
        else:
            return WiFiAuthMode.OPEN

    async def _monitor_connection(self) -> None:
        """Background task to monitor WiFi connection status."""
        while True:
            try:
                await asyncio.sleep(self.SIGNAL_CHECK_INTERVAL)
                await self._update_state()

                # If connected, publish signal update
                if self._state == WiFiState.CONNECTED:
                    connection_info = await self._get_connection_info()
                    if connection_info:
                        await self.event_bus.emit(
                            "wifi.signal_update",
                            {
                                "ssid": connection_info.ssid,
                                "rssi": connection_info.rssi,
                            },
                        )

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.exception("wifi_monitor_exception")
                await asyncio.sleep(5)  # Back off on error

"""Peripheral Manager

Manages peripheral detection, connection, compatibility validation,
and telemetry collection.
"""

import asyncio
import logging
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

import structlog

from yardrover.core.events import EventBus
from yardrover.models.peripherals import (
    CompatibilityCheckResponse,
    Peripheral,
    PeripheralHealth,
    PeripheralMetadata,
    PeripheralState,
    PeripheralStatus,
    PeripheralTelemetry,
    PeripheralType,
)
from yardrover.models.websocket import MessageType

logger = structlog.get_logger(__name__)


class PeripheralManager:
    """Manages peripherals: detection, connection, compatibility, telemetry

    Handles:
    - Auto-detection of peripherals via I2C/UART/CAN
    - Connection/disconnection lifecycle
    - Compatibility validation
    - Telemetry collection and broadcasting
    - Command routing to peripherals
    """

    def __init__(self, event_bus: Optional[EventBus] = None):
        """Initialize peripheral manager

        Args:
            event_bus: Event bus for publishing peripheral events
        """
        self.event_bus = event_bus
        self.peripherals: Dict[str, Peripheral] = {}
        self.peripherals_lock = asyncio.Lock()

        # Background tasks
        self.detection_task: Optional[asyncio.Task] = None
        self.telemetry_task: Optional[asyncio.Task] = None

        # Configuration
        self.detection_interval = 5.0  # seconds
        self.telemetry_interval = 1.0  # seconds

        # Stats
        self.total_connections = 0
        self.total_disconnections = 0

        self.is_running = False

        logger.info("peripheral_manager_initialized")

    async def start(self) -> None:
        """Start peripheral manager

        Starts background tasks for peripheral detection and telemetry collection.
        """
        if self.is_running:
            logger.warning("peripheral_manager_already_running")
            return

        self.is_running = True

        # Start background tasks
        self.detection_task = asyncio.create_task(self._detection_loop())
        self.telemetry_task = asyncio.create_task(self._telemetry_loop())

        logger.info("peripheral_manager_started")

    async def stop(self) -> None:
        """Stop peripheral manager

        Stops background tasks and disconnects all peripherals.
        """
        if not self.is_running:
            return

        self.is_running = False

        # Cancel background tasks
        if self.detection_task:
            self.detection_task.cancel()
            try:
                await self.detection_task
            except asyncio.CancelledError:
                pass
            self.detection_task = None

        if self.telemetry_task:
            self.telemetry_task.cancel()
            try:
                await self.telemetry_task
            except asyncio.CancelledError:
                pass
            self.telemetry_task = None

        # Disconnect all peripherals
        async with self.peripherals_lock:
            for peripheral_id in list(self.peripherals.keys()):
                await self._disconnect_peripheral(peripheral_id)

        logger.info("peripheral_manager_stopped")

    async def register_peripheral(self, metadata: PeripheralMetadata) -> bool:
        """Register a new peripheral

        Called when a peripheral is detected or manually added.

        Args:
            metadata: Peripheral metadata from device

        Returns:
            True if registered successfully, False otherwise
        """
        peripheral_id = metadata.peripheral_id

        async with self.peripherals_lock:
            # Check if already registered
            if peripheral_id in self.peripherals:
                logger.warning(
                    "peripheral_already_registered",
                    peripheral_id=peripheral_id,
                )
                return False

            # Check compatibility with existing peripherals
            compatibility_check = await self._check_compatibility_internal(metadata)
            if not compatibility_check.compatible:
                logger.warning(
                    "peripheral_incompatible",
                    peripheral_id=peripheral_id,
                    conflicts=compatibility_check.conflicts,
                )
                # Still register but mark as incompatible
                status = PeripheralStatus(
                    peripheral_id=peripheral_id,
                    state=PeripheralState.CONNECTED,
                    health=PeripheralHealth.ERROR,
                    enabled=False,
                    error_message=f"Incompatible: {compatibility_check.conflicts[0]['reason'] if compatibility_check.conflicts else 'Unknown'}",
                )
            else:
                # Create initial status
                status = PeripheralStatus(
                    peripheral_id=peripheral_id,
                    state=PeripheralState.CONNECTED,
                    health=PeripheralHealth.HEALTHY,
                    enabled=False,  # Disabled by default
                )

            # Create peripheral object
            peripheral = Peripheral(
                metadata=metadata,
                status=status,
                created=datetime.utcnow(),
                last_modified=datetime.utcnow(),
            )

            self.peripherals[peripheral_id] = peripheral
            self.total_connections += 1

        # Publish connection event
        if self.event_bus:
            await self.event_bus.publish(
                MessageType.PERIPHERAL_CONNECTED.value,
                {
                    "peripheral_id": peripheral_id,
                    "peripheral_type": metadata.type.value,
                    "name": metadata.name,
                    "compatible": compatibility_check.compatible,
                },
            )

        logger.info(
            "peripheral_registered",
            peripheral_id=peripheral_id,
            type=metadata.type.value,
            name=metadata.name,
        )

        return True

    async def unregister_peripheral(self, peripheral_id: str) -> bool:
        """Unregister a peripheral

        Args:
            peripheral_id: Peripheral identifier

        Returns:
            True if unregistered successfully, False if not found
        """
        async with self.peripherals_lock:
            if peripheral_id not in self.peripherals:
                logger.warning(
                    "peripheral_not_found",
                    peripheral_id=peripheral_id,
                )
                return False

            peripheral = self.peripherals[peripheral_id]

            # Disable if enabled
            if peripheral.status.enabled:
                await self._disable_peripheral_internal(peripheral_id)

            # Remove from registry
            del self.peripherals[peripheral_id]
            self.total_disconnections += 1

        # Publish disconnection event
        if self.event_bus:
            await self.event_bus.publish(
                MessageType.PERIPHERAL_DISCONNECTED.value,
                {
                    "peripheral_id": peripheral_id,
                    "peripheral_type": peripheral.metadata.type.value,
                },
            )

        logger.info(
            "peripheral_unregistered",
            peripheral_id=peripheral_id,
        )

        return True

    async def enable_peripheral(self, peripheral_id: str) -> bool:
        """Enable a peripheral

        Args:
            peripheral_id: Peripheral identifier

        Returns:
            True if enabled successfully, False otherwise
        """
        async with self.peripherals_lock:
            if peripheral_id not in self.peripherals:
                return False

            peripheral = self.peripherals[peripheral_id]

            # Check if already enabled
            if peripheral.status.enabled:
                logger.warning(
                    "peripheral_already_enabled",
                    peripheral_id=peripheral_id,
                )
                return True

            # Check compatibility before enabling
            compatibility_check = await self._check_compatibility_internal(
                peripheral.metadata
            )
            if not compatibility_check.compatible:
                logger.error(
                    "cannot_enable_incompatible_peripheral",
                    peripheral_id=peripheral_id,
                    conflicts=compatibility_check.conflicts,
                )
                return False

            # Enable peripheral
            peripheral.status.enabled = True
            peripheral.status.state = PeripheralState.READY
            peripheral.last_modified = datetime.utcnow()

        # Publish enabled event
        if self.event_bus:
            await self.event_bus.publish(
                MessageType.PERIPHERAL_ENABLED.value,
                {
                    "peripheral_id": peripheral_id,
                    "peripheral_type": peripheral.metadata.type.value,
                },
            )

        logger.info(
            "peripheral_enabled",
            peripheral_id=peripheral_id,
        )

        return True

    async def disable_peripheral(self, peripheral_id: str) -> bool:
        """Disable a peripheral

        Args:
            peripheral_id: Peripheral identifier

        Returns:
            True if disabled successfully, False if not found
        """
        async with self.peripherals_lock:
            return await self._disable_peripheral_internal(peripheral_id)

    async def _disable_peripheral_internal(self, peripheral_id: str) -> bool:
        """Internal disable peripheral (assumes lock is held)

        Args:
            peripheral_id: Peripheral identifier

        Returns:
            True if disabled successfully, False if not found
        """
        if peripheral_id not in self.peripherals:
            return False

        peripheral = self.peripherals[peripheral_id]

        if not peripheral.status.enabled:
            return True

        # Disable peripheral
        peripheral.status.enabled = False
        peripheral.status.active = False
        peripheral.status.state = PeripheralState.CONNECTED
        peripheral.last_modified = datetime.utcnow()

        # Publish disabled event
        if self.event_bus:
            await self.event_bus.publish(
                MessageType.PERIPHERAL_DISABLED.value,
                {
                    "peripheral_id": peripheral_id,
                    "peripheral_type": peripheral.metadata.type.value,
                },
            )

        logger.info(
            "peripheral_disabled",
            peripheral_id=peripheral_id,
        )

        return True

    async def send_command(
        self, peripheral_id: str, command: str, parameters: Dict[str, Any]
    ) -> bool:
        """Send command to peripheral

        Args:
            peripheral_id: Peripheral identifier
            command: Command name
            parameters: Command parameters

        Returns:
            True if command sent successfully, False otherwise
        """
        async with self.peripherals_lock:
            if peripheral_id not in self.peripherals:
                logger.error(
                    "peripheral_not_found",
                    peripheral_id=peripheral_id,
                )
                return False

            peripheral = self.peripherals[peripheral_id]

            if not peripheral.status.enabled:
                logger.error(
                    "peripheral_not_enabled",
                    peripheral_id=peripheral_id,
                )
                return False

        # TODO: Implement actual command sending via I2C/UART/CAN
        # For now, just log and publish event
        logger.info(
            "peripheral_command_sent",
            peripheral_id=peripheral_id,
            command=command,
            parameters=parameters,
        )

        if self.event_bus:
            await self.event_bus.publish(
                MessageType.PERIPHERAL_COMMAND_SENT.value,
                {
                    "peripheral_id": peripheral_id,
                    "command": command,
                    "parameters": parameters,
                },
            )

        return True

    async def get_peripheral(self, peripheral_id: str) -> Optional[Peripheral]:
        """Get peripheral by ID

        Args:
            peripheral_id: Peripheral identifier

        Returns:
            Peripheral object or None if not found
        """
        async with self.peripherals_lock:
            return self.peripherals.get(peripheral_id)

    async def list_peripherals(
        self, peripheral_type: Optional[PeripheralType] = None
    ) -> List[Peripheral]:
        """List all peripherals

        Args:
            peripheral_type: Optional filter by peripheral type

        Returns:
            List of peripherals
        """
        async with self.peripherals_lock:
            if peripheral_type:
                return [
                    p
                    for p in self.peripherals.values()
                    if p.metadata.type == peripheral_type
                ]
            return list(self.peripherals.values())

    async def check_compatibility(self) -> CompatibilityCheckResponse:
        """Check compatibility of current peripheral configuration

        Returns:
            Compatibility check response
        """
        async with self.peripherals_lock:
            enabled_peripherals = [
                p for p in self.peripherals.values() if p.status.enabled
            ]

            conflicts = []
            warnings = []

            # Check exclusive peripherals
            for i, p1 in enumerate(enabled_peripherals):
                for p2 in enabled_peripherals[i + 1 :]:
                    # Check if p1 is exclusive with p2
                    if p2.metadata.type in p1.metadata.compatibility.exclusive_with:
                        conflicts.append(
                            {
                                "peripheral1": p1.metadata.name,
                                "peripheral2": p2.metadata.name,
                                "reason": "Exclusive peripherals cannot operate together",
                            }
                        )

            # Check required peripherals
            for p in enabled_peripherals:
                for required_type in p.metadata.compatibility.requires:
                    if not any(
                        ep.metadata.type == required_type and ep.status.enabled
                        for ep in enabled_peripherals
                    ):
                        conflicts.append(
                            {
                                "peripheral": p.metadata.name,
                                "required": required_type.value,
                                "reason": f"Requires {required_type.value} to operate",
                            }
                        )

            # Check power consumption
            total_power = sum(
                p.metadata.capabilities.power_required for p in enabled_peripherals
            )
            if total_power > 1000:  # Warning threshold: 1000W
                warnings.append(
                    f"High power consumption: {total_power:.1f}W with current configuration"
                )

            # Check max concurrent peripherals of same type
            type_counts: Dict[PeripheralType, int] = {}
            for p in enabled_peripherals:
                type_counts[p.metadata.type] = type_counts.get(p.metadata.type, 0) + 1

            for p in enabled_peripherals:
                max_concurrent = p.metadata.compatibility.max_concurrent
                if type_counts[p.metadata.type] > max_concurrent:
                    conflicts.append(
                        {
                            "peripheral_type": p.metadata.type.value,
                            "count": type_counts[p.metadata.type],
                            "max": max_concurrent,
                            "reason": f"Maximum {max_concurrent} {p.metadata.type.value} allowed",
                        }
                    )

            return CompatibilityCheckResponse(
                compatible=len(conflicts) == 0,
                conflicts=conflicts,
                warnings=warnings,
            )

    async def _check_compatibility_internal(
        self, new_metadata: PeripheralMetadata
    ) -> CompatibilityCheckResponse:
        """Internal compatibility check for a new peripheral

        Args:
            new_metadata: Metadata of peripheral to check

        Returns:
            Compatibility check response
        """
        enabled_peripherals = [
            p for p in self.peripherals.values() if p.status.enabled
        ]

        conflicts = []
        warnings = []

        # Check if new peripheral is exclusive with any enabled peripheral
        for p in enabled_peripherals:
            if p.metadata.type in new_metadata.compatibility.exclusive_with:
                conflicts.append(
                    {
                        "peripheral1": new_metadata.name,
                        "peripheral2": p.metadata.name,
                        "reason": "Exclusive peripherals cannot operate together",
                    }
                )

        # Check if any enabled peripheral is exclusive with new peripheral
        for p in enabled_peripherals:
            if new_metadata.type in p.metadata.compatibility.exclusive_with:
                conflicts.append(
                    {
                        "peripheral1": p.metadata.name,
                        "peripheral2": new_metadata.name,
                        "reason": "Exclusive peripherals cannot operate together",
                    }
                )

        return CompatibilityCheckResponse(
            compatible=len(conflicts) == 0,
            conflicts=conflicts,
            warnings=warnings,
        )

    async def update_telemetry(
        self, peripheral_id: str, telemetry_data: Dict[str, Any]
    ) -> bool:
        """Update peripheral telemetry

        Args:
            peripheral_id: Peripheral identifier
            telemetry_data: Telemetry data

        Returns:
            True if updated successfully, False if peripheral not found
        """
        async with self.peripherals_lock:
            if peripheral_id not in self.peripherals:
                return False

            peripheral = self.peripherals[peripheral_id]

            # Update telemetry
            peripheral.telemetry = PeripheralTelemetry(
                peripheral_id=peripheral_id,
                timestamp=datetime.utcnow(),
                data=telemetry_data,
            )

            # Update last seen
            peripheral.status.last_seen = datetime.utcnow()

        # Publish telemetry event
        if self.event_bus:
            await self.event_bus.publish(
                MessageType.PERIPHERAL_TELEMETRY.value,
                {
                    "peripheral_id": peripheral_id,
                    "peripheral_type": peripheral.metadata.type.value,
                    "telemetry": telemetry_data,
                    "timestamp": datetime.utcnow().isoformat(),
                },
            )

        return True

    async def _detection_loop(self) -> None:
        """Background task for peripheral detection

        Periodically scans for new peripherals.
        """
        logger.info("peripheral_detection_loop_started")

        while self.is_running:
            try:
                # TODO: Implement actual peripheral detection via I2C/UART/CAN
                # For now, this is a placeholder that does nothing

                await asyncio.sleep(self.detection_interval)

            except asyncio.CancelledError:
                logger.info("peripheral_detection_loop_cancelled")
                break
            except Exception as e:
                logger.error(
                    "peripheral_detection_error",
                    error=str(e),
                )
                await asyncio.sleep(self.detection_interval)

        logger.info("peripheral_detection_loop_stopped")

    async def _telemetry_loop(self) -> None:
        """Background task for telemetry collection

        Periodically collects telemetry from enabled peripherals.
        """
        logger.info("peripheral_telemetry_loop_started")

        while self.is_running:
            try:
                # Get enabled peripherals
                async with self.peripherals_lock:
                    enabled_peripherals = [
                        p for p in self.peripherals.values() if p.status.enabled
                    ]

                # Collect telemetry from each peripheral
                for peripheral in enabled_peripherals:
                    # TODO: Implement actual telemetry collection via I2C/UART/CAN
                    # For now, this is a placeholder
                    pass

                await asyncio.sleep(self.telemetry_interval)

            except asyncio.CancelledError:
                logger.info("peripheral_telemetry_loop_cancelled")
                break
            except Exception as e:
                logger.error(
                    "peripheral_telemetry_error",
                    error=str(e),
                )
                await asyncio.sleep(self.telemetry_interval)

        logger.info("peripheral_telemetry_loop_stopped")

    async def _disconnect_peripheral(self, peripheral_id: str) -> None:
        """Disconnect a peripheral (internal helper)

        Args:
            peripheral_id: Peripheral identifier
        """
        if peripheral_id in self.peripherals:
            peripheral = self.peripherals[peripheral_id]
            peripheral.status.state = PeripheralState.DISCONNECTED
            peripheral.status.enabled = False
            peripheral.status.active = False

    def get_stats(self) -> Dict[str, Any]:
        """Get peripheral manager statistics

        Returns:
            Statistics dictionary
        """
        return {
            "total_peripherals": len(self.peripherals),
            "connected_peripherals": sum(
                1
                for p in self.peripherals.values()
                if p.status.state
                in [PeripheralState.CONNECTED, PeripheralState.READY, PeripheralState.ACTIVE]
            ),
            "enabled_peripherals": sum(
                1 for p in self.peripherals.values() if p.status.enabled
            ),
            "active_peripherals": sum(
                1 for p in self.peripherals.values() if p.status.active
            ),
            "total_connections": self.total_connections,
            "total_disconnections": self.total_disconnections,
        }

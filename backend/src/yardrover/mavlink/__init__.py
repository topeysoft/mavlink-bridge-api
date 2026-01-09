"""MAVLink communication module.

This module provides MAVLink message processing, serial communication,
and routing functionality for communication with flight controllers.
"""

from yardrover.mavlink.processor import MAVLinkProcessor

__all__ = ["MAVLinkProcessor"]

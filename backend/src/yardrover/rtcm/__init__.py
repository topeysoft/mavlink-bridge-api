"""RTCM client and routing modules.

This package provides RTCM (Radio Technical Commission for Maritime Services)
data source clients and output routing capabilities for RTK GPS positioning.

Supported RTCM sources:
- NTRIP: HTTP-based RTCM streaming (NTRIP 1.0/2.0)
- TCP: Raw TCP RTCM data streams (e.g., ESP32 base stations)
- UDP: Raw UDP RTCM data streams (e.g., ESP32 base stations)

Output routing supports:
- Serial ports
- TCP destinations
- UDP destinations
"""

from yardrover.rtcm.ntrip import NTRIPClient
from yardrover.rtcm.parser import RTCMParser
from yardrover.rtcm.router import RTCMOutputRouter
from yardrover.rtcm.tcp_client import TCPClient
from yardrover.rtcm.udp_client import UDPClient

__all__ = [
    "NTRIPClient",
    "TCPClient",
    "UDPClient",
    "RTCMParser",
    "RTCMOutputRouter",
]

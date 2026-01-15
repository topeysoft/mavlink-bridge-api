#!/usr/bin/env python3
"""Test script for RTCM UDP client.

This script tests the UDP RTCM client by:
1. Starting a UDP listener on port 2102
2. Sending test RTCM data via UDP
3. Verifying data reception and parsing
"""

import asyncio
import socket
import time

from yardrover.core.events import EventBus
from yardrover.models.rtcm import UDPSourceConfig
from yardrover.rtcm.udp_client import UDPClient


# Sample RTCM3 message (MSM7 GPS - message type 1077)
# This is a valid RTCM3 frame with proper preamble, length, and CRC24
SAMPLE_RTCM_MESSAGE = bytes.fromhex(
    "D3004D4350C0000000000005401C02C1F7FF00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000020DAC"
)


async def send_udp_data(host: str, port: int, data: bytes) -> None:
    """Send UDP data to the specified host and port.

    Args:
        host: Target host
        port: Target port
        data: Data to send
    """
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.sendto(data, (host, port))
        print(f"Sent {len(data)} bytes to {host}:{port}")
    finally:
        sock.close()


async def test_udp_client():
    """Test UDP RTCM client functionality."""
    print("=" * 80)
    print("RTCM UDP Client Test")
    print("=" * 80)

    # Create event bus
    event_bus = EventBus()

    # Track received data
    received_data = []
    received_events = []

    def data_callback(data: bytes) -> None:
        """Callback for received data."""
        received_data.append(data)
        print(f"Data callback: received {len(data)} bytes")

    async def event_handler(event_type: str, data: dict) -> None:
        """Handle events from the client."""
        received_events.append((event_type, data))
        print(f"Event: {event_type}")
        if event_type == "rtcm.data":
            print(f"  Message type: {data.get('message_type')} ({data.get('message_name')})")
            print(f"  Length: {data.get('length')} bytes")
            print(f"  Station ID: {data.get('station_id')}")
        elif event_type == "rtcm.state":
            print(f"  State: {data.get('state')} ({data.get('state_name')})")
        elif event_type == "rtcm.status.changed":
            print(f"  Running: {data.get('running')}")
            print(f"  State: {data.get('state')}")
            print(f"  Client type: {data.get('client_type')}")

    # Subscribe to events
    await event_bus.subscribe("rtcm.data", event_handler)
    await event_bus.subscribe("rtcm.state", event_handler)
    await event_bus.subscribe("rtcm.status.changed", event_handler)

    # Create UDP source config
    config = UDPSourceConfig(port=2102)

    # Create UDP client
    print("\n1. Creating UDP client...")
    client = UDPClient(
        config=config,
        event_bus=event_bus,
        data_callback=data_callback,
    )

    # Start client
    print("\n2. Starting UDP client on port 2102...")
    success = await client.start()

    if not success:
        print("❌ Failed to start UDP client")
        return

    print("✅ UDP client started successfully")
    print(f"   State: {client.state}")
    print(f"   Connected: {client.is_connected}")

    # Wait for client to be fully ready
    await asyncio.sleep(1)

    # Send test data
    print("\n3. Sending test RTCM data...")
    await send_udp_data("127.0.0.1", 2102, SAMPLE_RTCM_MESSAGE)

    # Wait for data to be processed
    await asyncio.sleep(1)

    # Send more data to test continuous reception
    print("\n4. Sending more test data...")
    for i in range(3):
        await send_udp_data("127.0.0.1", 2102, SAMPLE_RTCM_MESSAGE)
        await asyncio.sleep(0.2)

    # Wait for all data to be processed
    await asyncio.sleep(2)

    # Check results
    print("\n5. Checking results...")
    stats = client.statistics
    print(f"   Messages received: {stats.messages_received}")
    print(f"   Bytes received: {stats.bytes_received}")
    print(f"   Data rate: {stats.data_rate:.2f} KB/s")
    print(f"   Connection time: {stats.connection_time} ms")
    print(f"   Message types: {stats.message_type_counts}")

    # Parser diagnostics
    print(f"\n   Parser diagnostics:")
    print(f"   - Buffer size: {stats.parser_buffer_size} bytes")
    print(f"   - Frames with no preamble: {stats.frames_with_no_preamble}")
    print(f"   - Frames with invalid CRC: {stats.frames_with_invalid_crc}")
    print(f"   - Frames with invalid length: {stats.frames_with_invalid_length}")

    # Verify data callback
    print(f"\n   Data callbacks: {len(received_data)}")
    print(f"   Events received: {len(received_events)}")

    # Stop client
    print("\n6. Stopping UDP client...")
    await client.stop()

    print(f"   State: {client.state}")
    print(f"   Connected: {client.is_connected}")

    # Summary
    print("\n" + "=" * 80)
    print("Test Summary")
    print("=" * 80)

    success_count = 0
    total_tests = 5

    if client.state.value == "disconnected":
        print("✅ Client stopped successfully")
        success_count += 1
    else:
        print(f"❌ Client state should be 'disconnected', got '{client.state.value}'")

    if stats.messages_received >= 4:
        print(f"✅ Received expected messages ({stats.messages_received})")
        success_count += 1
    else:
        print(f"❌ Expected at least 4 messages, got {stats.messages_received}")

    if stats.bytes_received >= len(SAMPLE_RTCM_MESSAGE) * 4:
        print(f"✅ Received expected bytes ({stats.bytes_received})")
        success_count += 1
    else:
        print(f"❌ Expected at least {len(SAMPLE_RTCM_MESSAGE) * 4} bytes, got {stats.bytes_received}")

    if len(received_data) >= 4:
        print(f"✅ Data callbacks invoked ({len(received_data)})")
        success_count += 1
    else:
        print(f"❌ Expected at least 4 data callbacks, got {len(received_data)}")

    if len(received_events) > 0:
        print(f"✅ Events published ({len(received_events)})")
        success_count += 1
    else:
        print("❌ No events received")

    print(f"\n{success_count}/{total_tests} tests passed")

    if success_count == total_tests:
        print("\n🎉 All tests passed!")
        return True
    else:
        print(f"\n⚠️  {total_tests - success_count} test(s) failed")
        return False


if __name__ == "__main__":
    asyncio.run(test_udp_client())

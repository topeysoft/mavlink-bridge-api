#!/usr/bin/env python3
"""Quick test script to verify RTCM TCP client parsing."""

import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from yardrover.models.rtcm import TCPSourceConfig
from yardrover.rtcm.tcp_client import TCPClient


async def main():
    """Test RTCM TCP client."""
    print("Starting RTCM TCP client test...")
    print("Connecting to ESP32 at 192.168.86.32:2101")
    print("Press Ctrl+C to stop\n")

    config = TCPSourceConfig(host="192.168.86.32", port=2101)
    client = TCPClient(config)

    await client.start()

    try:
        # Run for 15 seconds
        for i in range(15):
            await asyncio.sleep(1)
            stats = client.statistics
            print(
                f"[{i+1:2d}s] State: {client.state.name:12s} | "
                f"Bytes: {stats.bytes_received:6d} | "
                f"Messages: {stats.messages_received:4d} | "
                f"No Preamble: {stats.frames_with_no_preamble:4d} | "
                f"Invalid CRC: {stats.frames_with_invalid_crc:4d} | "
                f"Rate: {stats.data_rate:6.2f} KB/s"
            )

            # Show message types if any
            if stats.message_type_counts:
                types = ", ".join(
                    f"{t}: {c}" for t, c in stats.message_type_counts.items()
                )
                print(f"       Message types: {types}")

    except KeyboardInterrupt:
        print("\n\nStopping...")
    finally:
        await client.stop()
        print("\nFinal statistics:")
        stats = client.statistics
        print(f"  Total bytes received: {stats.bytes_received}")
        print(f"  Total messages parsed: {stats.messages_received}")
        print(f"  Frames with no preamble: {stats.frames_with_no_preamble}")
        print(f"  Frames with invalid CRC: {stats.frames_with_invalid_crc}")
        print(f"  Message types: {stats.message_type_counts}")


if __name__ == "__main__":
    asyncio.run(main())

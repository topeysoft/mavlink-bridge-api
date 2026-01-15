#!/usr/bin/env python3
"""Test CRC calculation on the demo RTCM message."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "src"))

from yardrover.rtcm.parser import RTCMParser

# Demo message from ESP32 (25 bytes)
message_hex = "D300133ED01600E6CA025200D8535E5800243A7B94009B2732"
message_bytes = bytes.fromhex(message_hex)

print(f"Message hex: {message_hex}")
print(f"Message length: {len(message_bytes)} bytes")
print()

# Parse payload length
payload_len = ((message_bytes[1] & 0x03) << 8) | message_bytes[2]
print(f"Payload length (from header): {payload_len} bytes")
print(f"Total expected length: {payload_len + 6} bytes")
print()

# Extract CRC from message
message_crc = (message_bytes[-3] << 16) | (message_bytes[-2] << 8) | message_bytes[-1]
print(f"CRC in message: 0x{message_crc:06X} ({message_bytes[-3]:02X} {message_bytes[-2]:02X} {message_bytes[-1]:02X})")
print()

# Calculate CRC
parser = RTCMParser()
calculated_crc = parser._calculate_crc24(message_bytes[:-3])
print(f"Calculated CRC: 0x{calculated_crc:06X}")
print()

# Validate
valid = parser._validate_crc24(message_bytes)
print(f"CRC valid: {valid}")
print()

# Try parsing
parsed = parser.parse_message(message_bytes)
if parsed:
    print(f"✓ Message parsed successfully!")
    print(f"  Message type: {parsed.message_type}")
    print(f"  Payload length: {parsed.payload_length}")
    print(f"  Total length: {parsed.total_length}")
else:
    print(f"✗ Message parsing failed")

# Show byte breakdown
print("\nByte breakdown:")
print(f"  [0]    Preamble:  0x{message_bytes[0]:02X}")
print(f"  [1-2]  Length:    0x{message_bytes[1]:02X}{message_bytes[2]:02X} = {payload_len} bytes")
print(f"  [3-{3+payload_len-1}]  Payload:   {message_bytes[3:3+payload_len].hex()}")
print(f"  [{3+payload_len}-{3+payload_len+2}] CRC:       {message_bytes[3+payload_len:3+payload_len+3].hex()}")

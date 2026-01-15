#!/usr/bin/env python3
"""
Test script to verify mDNS discovery of RTK base stations.
"""

import asyncio
import sys
from zeroconf import ServiceBrowser, Zeroconf, ServiceListener
from zeroconf.asyncio import AsyncZeroconf, AsyncServiceBrowser, AsyncServiceInfo


class TestListener(ServiceListener):
    """Test listener for sync discovery."""

    def __init__(self):
        self.services = []

    def add_service(self, zc: Zeroconf, service_type: str, name: str) -> None:
        print(f"✓ Service found: {name}")
        print(f"  Type: {service_type}")
        info = zc.get_service_info(service_type, name)
        if info:
            addresses = [".".join(str(b) for b in addr) for addr in info.addresses if len(addr) == 4]
            print(f"  Host: {info.server}")
            print(f"  Port: {info.port}")
            print(f"  Addresses: {addresses}")
            if info.properties:
                print(f"  TXT: {info.properties}")
        self.services.append(name)

    def remove_service(self, zc: Zeroconf, service_type: str, name: str) -> None:
        print(f"✗ Service removed: {name}")

    def update_service(self, zc: Zeroconf, service_type: str, name: str) -> None:
        print(f"↻ Service updated: {name}")


async def test_async_discovery():
    """Test async discovery."""
    print("\n=== Testing Async Discovery ===\n")

    service_types = [
        '_rtk-base._tcp.local.',
        '_rtk._tcp.local.',
        '_http._tcp.local.',
    ]

    azc = AsyncZeroconf()

    for service_type in service_types:
        print(f"\nSearching for {service_type}...")

        class AsyncTestListener:
            def __init__(self):
                self.services = []

            def add_service(self, zc, service_type, name):
                pass

            def remove_service(self, zc, service_type, name):
                pass

            def update_service(self, zc, service_type, name):
                pass

            async def async_add_service(self, zeroconf, service_type, name):
                print(f"  ✓ Found: {name}")
                info = AsyncServiceInfo(service_type, name)
                if await info.async_request(zeroconf, 3000):
                    addresses = [".".join(str(b) for b in addr) for addr in info.addresses if len(addr) == 4]
                    print(f"    Host: {info.server}")
                    print(f"    Port: {info.port}")
                    print(f"    IP: {addresses}")
                    if info.properties:
                        txt = {k.decode('utf-8'): v.decode('utf-8') for k, v in info.properties.items()}
                        print(f"    TXT: {txt}")
                self.services.append(name)

            async def async_remove_service(self, zeroconf, service_type, name):
                pass

            async def async_update_service(self, zeroconf, service_type, name):
                pass

        listener = AsyncTestListener()
        browser = AsyncServiceBrowser(
            azc.zeroconf,
            [service_type],
            handlers=[
                listener.async_add_service,
                listener.async_remove_service,
                listener.async_update_service,
            ],
        )

        # Wait for discovery
        await asyncio.sleep(5)

        print(f"  Found {len(listener.services)} service(s)")

    await azc.async_close()


def test_sync_discovery():
    """Test synchronous discovery."""
    print("\n=== Testing Sync Discovery ===\n")

    service_types = [
        '_rtk-base._tcp.local.',
        '_rtk._tcp.local.',
    ]

    zc = Zeroconf()

    for service_type in service_types:
        print(f"\nSearching for {service_type}...")
        listener = TestListener()
        browser = ServiceBrowser(zc, service_type, listener)

        # Wait for discovery
        import time
        time.sleep(5)

        print(f"Found {len(listener.services)} service(s)")
        browser.cancel()

    zc.close()


if __name__ == '__main__':
    print("=" * 60)
    print("mDNS Discovery Test")
    print("=" * 60)

    # Test sync first
    test_sync_discovery()

    # Test async
    asyncio.run(test_async_discovery())

    print("\n" + "=" * 60)
    print("Test complete")
    print("=" * 60)

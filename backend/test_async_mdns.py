#!/usr/bin/env python3
"""
Quick test for async mDNS discovery with correct handler signatures.
"""

import asyncio
from zeroconf import ServiceStateChange, Zeroconf
from zeroconf.asyncio import AsyncZeroconf, AsyncServiceBrowser, AsyncServiceInfo


async def test_discovery():
    """Test async discovery with handlers."""

    print("Starting async mDNS discovery test...")

    azc = AsyncZeroconf()

    found_services = []

    def on_service_state_change(
        zeroconf: Zeroconf,
        service_type: str,
        name: str,
        state_change: ServiceStateChange,
    ) -> None:
        """Handler for service state changes - MUST be sync!"""
        print(f"Service {state_change.name}: {name}")

        if state_change == ServiceStateChange.Added or state_change == ServiceStateChange.Updated:
            info = zeroconf.get_service_info(service_type, name, timeout=3000)
            if info:
                addresses = [".".join(str(b) for b in addr) for addr in info.addresses if len(addr) == 4]
                print(f"  Host: {info.server}")
                print(f"  Port: {info.port}")
                print(f"  IP: {addresses}")
                if info.properties:
                    txt = {k.decode('utf-8'): v.decode('utf-8') if v else '' for k, v in info.properties.items()}
                    print(f"  TXT: {txt}")
                found_services.append(name)

    service_types = ['_rtk-base._tcp.local.', '_rtk._tcp.local.']
    browsers = []

    for service_type in service_types:
        print(f"\nSearching for {service_type}...")
        browser = AsyncServiceBrowser(
            azc.zeroconf,
            [service_type],
            handlers=[on_service_state_change],
        )
        browsers.append(browser)

    # Wait for discovery
    print("\nWaiting 5 seconds for discovery...")
    await asyncio.sleep(5)

    print(f"\n✓ Found {len(found_services)} service(s)")
    for service in found_services:
        print(f"  - {service}")

    # Cleanup
    for browser in browsers:
        await browser.async_cancel()

    await azc.async_close()

    return len(found_services) > 0


if __name__ == '__main__':
    result = asyncio.run(test_discovery())

    if result:
        print("\n✅ SUCCESS: Async mDNS discovery is working!")
        exit(0)
    else:
        print("\n❌ FAILED: No services found")
        exit(1)

#!/usr/bin/env ts-node

/**
 * Enhanced Health Monitoring Example
 * 
 * Demonstrates how to use the enhanced health check endpoint
 * to get comprehensive device and system information.
 */

import { MAVLinkBridgeClient } from '../src/MAVLinkBridgeClient';
import { HealthCheckResponse, DeviceInfo, NetworkInfo, WiFiInfo } from '../src/health/HealthTypes';

const DEVICE_IP = process.env.DEVICE_IP || '192.168.4.1';

async function main() {
  console.log('🔍 Enhanced Health Monitoring Example');
  console.log('=====================================\n');

  const client = new MAVLinkBridgeClient(`http://${DEVICE_IP}`);

  try {
    // Get comprehensive health check
    console.log('📊 Getting comprehensive health information...');
    const health: HealthCheckResponse = await client.health.getHealthCheck();
    
    // Display overall health status
    console.log(`\n🏥 System Status: ${health.status.toUpperCase()}`);
    console.log(`⏱️  Uptime: ${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m ${health.uptime % 60}s`);
    console.log(`💾 Free Heap: ${(health.freeHeap / 1024).toFixed(1)} KB`);
    
    if (health.issues && health.issues.length > 0) {
      console.log(`⚠️  Issues: ${health.issues.join(', ')}`);
    }

    // Device Information
    console.log('\n🖥️  Device Information:');
    console.log(`   Hostname: ${health.device.hostname}`);
    console.log(`   Name: ${health.device.name}`);
    console.log(`   Chip: ${health.device.chipModel} (Rev ${health.device.chipRevision})`);
    console.log(`   Flash: ${(health.device.flashSize / 1024 / 1024).toFixed(1)} MB`);
    console.log(`   SDK: ${health.device.sdkVersion}`);
    console.log(`   Cores: ${health.device.coreCount}`);

    // Network Information
    console.log('\n🌐 Network Information:');
    console.log(`   MAC Address: ${health.network.macAddress}`);
    console.log(`   AP MAC Address: ${health.network.apMacAddress}`);

    // WiFi Status
    const wifi = health.network.wifi;
    console.log('\n📶 WiFi Status:');
    console.log(`   Status: ${wifi.status}`);
    
    if (wifi.status === 'connected' && wifi.ssid) {
      console.log(`   SSID: ${wifi.ssid}`);
      console.log(`   IP Address: ${wifi.ip}`);
      console.log(`   Gateway: ${wifi.gateway}`);
      console.log(`   Signal Strength: ${wifi.rssi} dBm`);
      console.log(`   Channel: ${wifi.channel}`);
      console.log(`   Router MAC: ${wifi.bssid}`);
    }

    // Access Point Status
    const ap = health.network.ap;
    console.log('\n📡 Access Point:');
    console.log(`   Enabled: ${ap.enabled ? 'Yes' : 'No'}`);
    if (ap.enabled) {
      console.log(`   IP Address: ${ap.ip}`);
      console.log(`   SSID: ${ap.ssid}`);
      console.log(`   Connected Clients: ${ap.clients}`);
    }

    // System Health (if available)
    if (health.system) {
      console.log('\n⚙️  System Health:');
      console.log(`   System Healthy: ${health.system.systemHealthy ? 'Yes' : 'No'}`);
      console.log(`   CPU Usage: ${health.system.cpuUsage.toFixed(1)}%`);
      console.log(`   Temperature: ${health.system.temperature.toFixed(1)}°C`);
      console.log(`   Low Memory Warning: ${health.system.lowMemoryWarning ? 'Yes' : 'No'}`);
      console.log(`   Min Free Heap: ${(health.system.minFreeHeap / 1024).toFixed(1)} KB`);
      console.log(`   Largest Free Block: ${(health.system.largestFreeBlock / 1024).toFixed(1)} KB`);
      console.log(`   Running Tasks: ${health.system.taskCount}`);
      console.log(`   Monitored Components: ${health.system.componentCount}`);

      if (health.system.components.length > 0) {
        console.log('\n   Component Status:');
        health.system.components.forEach(comp => {
          const status = comp.healthy ? '✅' : '❌';
          console.log(`     ${status} ${comp.name}: ${comp.status}`);
        });
      }
    }

    // Storage Information
    console.log('\n💿 Storage Information:');
    const storageUsedPercent = (health.storage.usedBytes / health.storage.totalBytes * 100).toFixed(1);
    console.log(`   Total: ${(health.storage.totalBytes / 1024).toFixed(1)} KB`);
    console.log(`   Used: ${(health.storage.usedBytes / 1024).toFixed(1)} KB (${storageUsedPercent}%)`);
    console.log(`   Free: ${(health.storage.freeBytes / 1024).toFixed(1)} KB`);
    console.log(`   Healthy: ${health.storage.healthy ? 'Yes' : 'No'}`);

    // Configuration Status
    console.log('\n⚙️  Configuration:');
    console.log(`   Version: ${health.config.version}`);
    console.log(`   Has Unsaved Changes: ${health.config.isDirty ? 'Yes' : 'No'}`);

    // Demonstrate convenience methods
    console.log('\n🛠️  Using Convenience Methods:');
    
    const hostname = await client.health.getHostname();
    console.log(`   Device Hostname: ${hostname}`);
    
    const macAddress = await client.health.getMacAddress();
    console.log(`   MAC Address: ${macAddress}`);
    
    const isWiFiConnected = await client.health.isWiFiConnected();
    console.log(`   WiFi Connected: ${isWiFiConnected}`);
    
    if (isWiFiConnected) {
      const ipAddress = await client.health.getIpAddress();
      const signalStrength = await client.health.getSignalStrength();
      console.log(`   IP Address: ${ipAddress}`);
      console.log(`   Signal Strength: ${signalStrength} dBm`);
    }
    
    const isAPEnabled = await client.health.isAccessPointEnabled();
    console.log(`   Access Point Enabled: ${isAPEnabled}`);
    
    const storageUsage = await client.health.getStorageUsage();
    console.log(`   Storage Usage: ${storageUsage.toFixed(1)}%`);

    // Check for system issues
    const issues = await client.health.getSystemIssues();
    if (issues.length > 0) {
      console.log(`\n⚠️  System Issues Detected: ${issues.join(', ')}`);
    } else {
      console.log('\n✅ No system issues detected');
    }

  } catch (error) {
    console.error('❌ Error getting health information:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { main };
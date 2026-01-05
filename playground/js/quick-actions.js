/**
 * Quick Actions Panel
 * Common operations and system dashboard
 */

export class QuickActions {
  constructor(deviceConnection) {
    this.deviceConnection = deviceConnection;
    this.healthUpdateInterval = null;
  }

  /**
   * Initialize quick actions
   */
  init() {
    this.setupEventListeners();

    this.deviceConnection.onConnect((client) => {
      this.startHealthMonitoring(client);
    });

    this.deviceConnection.onDisconnect(() => {
      this.stopHealthMonitoring();
      this.resetHealthDisplay();
    });

    this.deviceConnection.onStatusUpdate((health) => {
      this.updateHealthDisplay(health);
    });
  }

  /**
   * Setup event listeners for quick action buttons
   */
  setupEventListeners() {
    // MAVLink control buttons
    document.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const action = btn.getAttribute('data-action');
        await this.executeAction(action, btn);
      });
    });
  }

  /**
   * Execute quick action
   */
  async executeAction(action, button) {
    const client = this.deviceConnection.getClient();
    if (!client) {
      alert('Please connect to a device first');
      return;
    }

    // Disable button during execution
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = '⏳';

    try {
      switch (action) {
        case 'arm':
          await this.armVehicle(client);
          break;
        case 'disarm':
          await this.disarmVehicle(client);
          break;
        case 'takeoff':
          await this.takeoff(client);
          break;
        case 'land':
          await this.land(client);
          break;
        case 'rtl':
          await this.returnToLaunch(client);
          break;
        case 'wifi-connect':
          await this.quickWifiConnect(client);
          break;
        case 'rtcm-start':
          await this.startRTCM(client);
          break;
        case 'rtcm-stop':
          await this.stopRTCM(client);
          break;
        case 'rtcm-status':
          await this.getRTCMStatus(client);
          break;
        default:
          console.warn('Unknown action:', action);
      }

      this.showSuccess(`Action "${action}" completed`);
    } catch (error) {
      console.error(`Action "${action}" failed:`, error);
      this.showError(`Action failed: ${error.message}`);
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  /**
   * Arm vehicle
   */
  async armVehicle(client) {
    await client.arm();
  }

  /**
   * Disarm vehicle
   */
  async disarmVehicle(client) {
    await client.disarm();
  }

  /**
   * Takeoff
   */
  async takeoff(client) {
    const altitude = prompt('Enter takeoff altitude (meters):', '10');
    if (altitude) {
      await client.takeoff(parseFloat(altitude));
    }
  }

  /**
   * Land
   */
  async land(client) {
    await client.land();
  }

  /**
   * Return to launch
   */
  async returnToLaunch(client) {
    await client.returnToLaunch();
  }

  /**
   * Quick WiFi connect
   */
  async quickWifiConnect(client) {
    const ssid = document.getElementById('quickWifiSsid').value;
    const password = document.getElementById('quickWifiPass').value;

    if (!ssid) {
      alert('Please enter SSID');
      return;
    }

    await client.connectToWiFi({ ssid, password });

    // Clear password field
    document.getElementById('quickWifiPass').value = '';
  }

  /**
   * Start RTCM client
   */
  async startRTCM(client) {
    await client.startRTCM();
  }

  /**
   * Stop RTCM client
   */
  async stopRTCM(client) {
    await client.stopRTCM();
  }

  /**
   * Get RTCM status
   */
  async getRTCMStatus(client) {
    const status = await client.getRTCMStatus();
    alert(JSON.stringify(status, null, 2));
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring(client) {
    this.stopHealthMonitoring();

    // Update immediately
    this.updateHealth(client);

    // Update every 5 seconds
    this.healthUpdateInterval = setInterval(() => {
      this.updateHealth(client);
    }, 5000);
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring() {
    if (this.healthUpdateInterval) {
      clearInterval(this.healthUpdateInterval);
      this.healthUpdateInterval = null;
    }
  }

  /**
   * Update health data
   */
  async updateHealth(client) {
    try {
      const health = await client.getHealth();
      this.updateHealthDisplay(health);
    } catch (error) {
      console.error('Failed to update health:', error);
    }
  }

  /**
   * Update health display
   */
  updateHealthDisplay(health) {
    // Status
    const statusEl = document.getElementById('healthStatus');
    if (statusEl) {
      statusEl.textContent = health.status || 'Unknown';
      statusEl.style.color = this.getStatusColor(health.status);
    }

    // Uptime
    const uptimeEl = document.getElementById('healthUptime');
    if (uptimeEl && health.uptime !== undefined) {
      uptimeEl.textContent = this.formatUptime(health.uptime);
    }

    // Free Heap
    const heapEl = document.getElementById('healthHeap');
    if (heapEl && health.freeHeap !== undefined) {
      heapEl.textContent = this.formatBytes(health.freeHeap);
    }

    // WiFi
    const wifiEl = document.getElementById('healthWifi');
    if (wifiEl && health.network?.wifi) {
      const wifi = health.network.wifi;
      if (wifi.status === 'connected') {
        wifiEl.textContent = `${wifi.ssid} (${wifi.rssi} dBm)`;
        wifiEl.style.color = 'var(--success-color)';
      } else {
        wifiEl.textContent = wifi.status || 'Disconnected';
        wifiEl.style.color = 'var(--text-secondary)';
      }
    }
  }

  /**
   * Reset health display
   */
  resetHealthDisplay() {
    document.getElementById('healthStatus').textContent = '-';
    document.getElementById('healthUptime').textContent = '-';
    document.getElementById('healthHeap').textContent = '-';
    document.getElementById('healthWifi').textContent = '-';
  }

  /**
   * Get status color
   */
  getStatusColor(status) {
    switch (status?.toLowerCase()) {
      case 'ok':
      case 'healthy':
        return 'var(--success-color)';
      case 'warning':
        return 'var(--warning-color)';
      case 'error':
      case 'critical':
        return 'var(--danger-color)';
      default:
        return 'var(--text-primary)';
    }
  }

  /**
   * Format uptime
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  /**
   * Format bytes
   */
  formatBytes(bytes) {
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    console.log('[SUCCESS]', message);
    // Can add toast notification here
  }

  /**
   * Show error message
   */
  showError(message) {
    console.error('[ERROR]', message);
    alert(message);
  }
}

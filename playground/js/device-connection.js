/**
 * Device Connection Manager
 * Handles device discovery, connection, and status monitoring
 */

export class DeviceConnection {
  constructor(config) {
    this.config = config;
    this.client = null;
    this.deviceUrl = null;
    this.connected = false;
    this.discovery = null;
    this.statusCheckInterval = null;
    this.callbacks = {
      onConnect: [],
      onDisconnect: [],
      onStatusUpdate: [],
    };
  }

  /**
   * Initialize the connection UI and event handlers
   */
  init() {
    this.setupEventListeners();
    this.loadSavedDevice();
  }

  /**
   * Setup UI event listeners
   */
  setupEventListeners() {
    // Connect button
    document.getElementById('connectBtn').addEventListener('click', () => {
      const url = document.getElementById('deviceUrl').value;
      this.connect(url);
    });

    // Discovery button
    document.getElementById('discoveryBtn').addEventListener('click', () => {
      this.openDiscoveryModal();
    });

    // Close modal
    document.getElementById('closeModalBtn').addEventListener('click', () => {
      this.closeDiscoveryModal();
    });

    // Enter key on URL input
    document.getElementById('deviceUrl').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const url = e.target.value;
        this.connect(url);
      }
    });
  }

  /**
   * Connect to a device
   */
  async connect(url) {
    if (!url) {
      this.showError('Please enter a device URL');
      return;
    }

    this.updateConnectionStatus('connecting', 'Connecting...');

    try {
      // Dynamically import the client library (browser bundle)
      const { MAVLinkBridgeClient } = await import(
        '/client/dist/browser/index.js'
      );

      // Create client instance
      this.client = new MAVLinkBridgeClient(url, {
        httpTimeout: 10000,
        maxReconnectAttempts: 3,
        autoConnectWebSocket: true,
      });

      // Connect to device
      await this.client.connect();

      this.deviceUrl = url;
      this.connected = true;

      // Save device URL
      localStorage.setItem('lastDeviceUrl', url);

      this.updateConnectionStatus('connected', 'Connected');
      this.startStatusMonitoring();

      // Trigger callbacks
      this.callbacks.onConnect.forEach((cb) => cb(this.client, url));

      this.showSuccess(`Connected to ${url}`);
    } catch (error) {
      console.error('Connection failed:', error);
      this.updateConnectionStatus('disconnected', 'Connection failed');
      this.showError(`Failed to connect: ${error.message}`);
    }
  }

  /**
   * Disconnect from device
   */
  async disconnect() {
    if (this.client) {
      try {
        await this.client.disconnect();
      } catch (error) {
        console.error('Disconnect error:', error);
      }
    }

    this.stopStatusMonitoring();
    this.connected = false;
    this.client = null;
    this.deviceUrl = null;

    this.updateConnectionStatus('disconnected', 'Disconnected');

    // Trigger callbacks
    this.callbacks.onDisconnect.forEach((cb) => cb());
  }

  /**
   * Update connection status UI
   */
  updateConnectionStatus(status, text) {
    const statusEl = document.getElementById('connectionStatus');
    const indicator = statusEl.querySelector('.status-indicator');
    const statusText = statusEl.querySelector('.status-text');

    indicator.className = `status-indicator ${status}`;
    statusText.textContent = text;
  }

  /**
   * Start monitoring device status
   */
  async startStatusMonitoring() {
    // Clear existing interval
    this.stopStatusMonitoring();

    // Update status immediately
    await this.updateDeviceStatus();

    // Set up periodic updates
    this.statusCheckInterval = setInterval(async () => {
      await this.updateDeviceStatus();
    }, 5000); // Every 5 seconds
  }

  /**
   * Stop status monitoring
   */
  stopStatusMonitoring() {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }
  }

  /**
   * Update device status
   */
  async updateDeviceStatus() {
    if (!this.client || !this.connected) return;

    try {
      const health = await this.client.getHealth();

      // Trigger status update callbacks
      this.callbacks.onStatusUpdate.forEach((cb) => cb(health));
    } catch (error) {
      console.error('Status update failed:', error);
      // If status check fails, assume disconnected
      this.disconnect();
    }
  }

  /**
   * Open device discovery modal
   */
  async openDiscoveryModal() {
    const modal = document.getElementById('discoveryModal');
    modal.classList.add('active');

    const devicesContainer = document.getElementById('discoveredDevices');
    devicesContainer.innerHTML = '';

    try {
      // Dynamically import discovery (browser bundle)
      const { startContinuousDiscovery } = await import('/client/dist/browser/index.js');

      // Get discovery options from config
      const discoveryOptions = this.config.getDiscoveryOptions();

      console.log('🔍 Starting discovery with options:', discoveryOptions);

      // Start continuous discovery with callbacks
      const stopDiscovery = startContinuousDiscovery(
        (device) => {
          // Device found callback
          this.addDiscoveredDevice(device);
        },
        (deviceId) => {
          // Device lost callback (optional)
          console.log('Device lost:', deviceId);
        },
        discoveryOptions
      );

      // Store stop function
      this.discovery = { stop: stopDiscovery };

      // Auto-stop after 10 seconds
      setTimeout(() => {
        if (this.discovery) {
          this.discovery.stop();
          this.discovery = null;
        }
      }, 10000);
    } catch (error) {
      console.error('Discovery failed:', error);
      devicesContainer.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--danger-color);">
                    <p>Discovery failed: ${error.message}</p>
                    <p style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 0.5rem;">
                        Device discovery requires mDNS support. You can manually enter the device IP address.
                    </p>
                </div>
            `;
    }
  }

  /**
   * Close discovery modal
   */
  closeDiscoveryModal() {
    const modal = document.getElementById('discoveryModal');
    modal.classList.remove('active');

    if (this.discovery) {
      this.discovery.stop();
      this.discovery = null;
    }
  }

  /**
   * Add discovered device to modal
   */
  addDiscoveredDevice(device) {
    const devicesContainer = document.getElementById('discoveredDevices');

    // Check if device already exists
    const existingDevice = devicesContainer.querySelector(
      `[data-url="${device.url}"]`,
    );
    if (existingDevice) return;

    const deviceCard = document.createElement('div');
    deviceCard.className = 'device-card';
    deviceCard.setAttribute('data-url', device.url);

    deviceCard.innerHTML = `
            <div class="device-name">${
              device.name || 'MAVLinkBridge Device'
            }</div>
            <div class="device-info">
                <div>URL: ${device.url}</div>
                <div>IP: ${device.ip}</div>
                ${
                  device.hostname
                    ? `<div>Hostname: ${device.hostname}</div>`
                    : ''
                }
            </div>
        `;

    deviceCard.addEventListener('click', () => {
      document.getElementById('deviceUrl').value = device.url;
      this.closeDiscoveryModal();
      this.connect(device.url);
    });

    devicesContainer.appendChild(deviceCard);
  }

  /**
   * Load saved device from localStorage or use config default
   */
  loadSavedDevice() {
    const savedUrl = localStorage.getItem('lastDeviceUrl');
    const defaultUrl = this.config.getDefaultDeviceUrl();

    document.getElementById('deviceUrl').value = savedUrl || defaultUrl;
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  /**
   * Show error message
   */
  showError(message) {
    this.showNotification(message, 'error');
  }

  /**
   * Show notification
   */
  showNotification(message, type) {
    // Simple notification - can be enhanced with a toast library
    console.log(`[${type.toUpperCase()}] ${message}`);

    // You can add a toast notification library here
    // For now, we'll use a simple alert for errors
    if (type === 'error') {
      alert(message);
    }
  }

  /**
   * Register callback for connection event
   */
  onConnect(callback) {
    this.callbacks.onConnect.push(callback);
  }

  /**
   * Register callback for disconnection event
   */
  onDisconnect(callback) {
    this.callbacks.onDisconnect.push(callback);
  }

  /**
   * Register callback for status update event
   */
  onStatusUpdate(callback) {
    this.callbacks.onStatusUpdate.push(callback);
  }

  /**
   * Get current client instance
   */
  getClient() {
    return this.client;
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.connected;
  }
}

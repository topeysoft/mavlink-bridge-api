/**
 * Configuration Loader
 * Loads and parses playground configuration from config.yaml
 */

export class ConfigLoader {
  constructor() {
    this.config = null;
  }

  /**
   * Load configuration from YAML file
   */
  async load() {
    try {
      const response = await fetch('/config.yaml');
      if (!response.ok) {
        throw new Error(`Failed to load config: ${response.statusText}`);
      }

      const yamlText = await response.text();

      // Parse YAML using js-yaml library (already loaded in index.html)
      if (typeof jsyaml === 'undefined') {
        throw new Error('js-yaml library not loaded');
      }

      this.config = jsyaml.load(yamlText);
      console.log('✅ Configuration loaded:', this.config);

      return this.config;
    } catch (error) {
      console.error('Failed to load configuration:', error);

      // Return default configuration as fallback
      return this.getDefaultConfig();
    }
  }

  /**
   * Get default configuration (fallback)
   */
  getDefaultConfig() {
    return {
      discovery: {
        subnets: [],
        ports: [80, 8080],
        knownHostnames: [
          'mavlinkbridge.local',
          'esp32-mavlinkbridge.local',
          'yardrover.local',
          'yardrover-esp32.local'
        ],
        apModeIPs: ['192.168.4.1'],
        interval: 5000,
        timeout: 5000,
        concurrent: 20
      },
      defaultDevice: {
        url: 'http://192.168.4.1'
      },
      websocket: {
        autoScroll: true,
        maxEvents: 1000,
        defaultEventTypes: []
      },
      apiExplorer: {
        autoExpand: false,
        httpTimeout: 10000
      },
      quickActions: {
        mavlinkControl: true,
        wifiManagement: true,
        rtcmControl: true,
        systemHealth: true,
        healthUpdateInterval: 5000
      }
    };
  }

  /**
   * Get configuration value by path
   * @param {string} path - Dot notation path (e.g., 'discovery.subnets')
   * @param {*} defaultValue - Default value if path not found
   */
  get(path, defaultValue = null) {
    if (!this.config) {
      console.warn('Configuration not loaded, using defaults');
      this.config = this.getDefaultConfig();
    }

    const keys = path.split('.');
    let value = this.config;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return defaultValue;
      }
    }

    return value;
  }

  /**
   * Get discovery options
   */
  getDiscoveryOptions() {
    return {
      subnets: this.get('discovery.subnets', []),
      ports: this.get('discovery.ports', [80, 8080]),
      knownHostnames: this.get('discovery.knownHostnames', []),
      apModeIPs: this.get('discovery.apModeIPs', ['192.168.4.1']),
      interval: this.get('discovery.interval', 5000),
      timeout: this.get('discovery.timeout', 5000),
      concurrent: this.get('discovery.concurrent', 20)
    };
  }

  /**
   * Get default device URL
   */
  getDefaultDeviceUrl() {
    return this.get('defaultDevice.url', 'http://192.168.4.1');
  }

  /**
   * Get WebSocket console settings
   */
  getWebSocketSettings() {
    return {
      autoScroll: this.get('websocket.autoScroll', true),
      maxEvents: this.get('websocket.maxEvents', 1000),
      defaultEventTypes: this.get('websocket.defaultEventTypes', [])
    };
  }

  /**
   * Get API Explorer settings
   */
  getApiExplorerSettings() {
    return {
      autoExpand: this.get('apiExplorer.autoExpand', false),
      httpTimeout: this.get('apiExplorer.httpTimeout', 10000)
    };
  }

  /**
   * Get Quick Actions settings
   */
  getQuickActionsSettings() {
    return {
      mavlinkControl: this.get('quickActions.mavlinkControl', true),
      wifiManagement: this.get('quickActions.wifiManagement', true),
      rtcmControl: this.get('quickActions.rtcmControl', true),
      systemHealth: this.get('quickActions.systemHealth', true),
      healthUpdateInterval: this.get('quickActions.healthUpdateInterval', 5000)
    };
  }
}

// Create singleton instance
export const config = new ConfigLoader();

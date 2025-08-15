import { HttpClient, HttpError } from '../core/HttpClient';
import {
  Configuration,
  ConfigPatchOperation,
  ConfigUpdateOptions,
  HealthResponse,
  ConfigValidator,
  VersionConflictError,
  ConfigValidationError,
  StorageError
} from './ConfigTypes';
import * as jsonpatch from 'fast-json-patch';

type Operation = jsonpatch.Operation;

/**
 * Client for configuration management operations
 */
export class ConfigClient {
  private readonly httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /**
   * Get the current device configuration
   */
  async getConfiguration (): Promise<Configuration> {
    return this.httpClient.get<Configuration>('/api/config');
  }

  /**
   * Replace the entire configuration
   */
  async setConfiguration (config: Configuration, options?: ConfigUpdateOptions): Promise<void> {
    if (options?.validate !== false) {
      const validationErrors = ConfigValidator.validateConfiguration(config);
      if (validationErrors.length > 0) {
        throw new ConfigValidationError(validationErrors);
      }
    }

    try {
      const headers: Record<string, string> = {};
      if (options?.expectedVersion !== undefined) {
        headers['X-Config-Version'] = options.expectedVersion.toString();
      }

      const requestOptions: any = { headers };
      if (options?.timeout !== undefined) {
        requestOptions.timeout = options.timeout;
      }

      await this.httpClient.post<void>('/api/config', config, requestOptions);
    } catch (error: any) {
      this.handleConfigError(error);
    }
  }

  /**
   * Apply a JSON patch to the configuration
   */
  async patchConfiguration (operations: ConfigPatchOperation[], options?: ConfigUpdateOptions): Promise<void> {
    if (operations.length === 0) {
      return;
    }

    if (operations.length > 10) {
      throw new Error('Too many patch operations (maximum 10 allowed)');
    }

    try {
      const headers: Record<string, string> = {};
      if (options?.expectedVersion !== undefined) {
        headers['X-Config-Version'] = options.expectedVersion.toString();
      }

      // Convert to standard JSON Patch format
      const patches: Operation[] = operations.map(op => ({
        op: op.op,
        path: op.path,
        value: op.value,
        from: op.from
      } as Operation));

      const requestOptions: any = { headers };
      if (options?.timeout !== undefined) {
        requestOptions.timeout = options.timeout;
      }

      await this.httpClient.patch<void>('/api/config', patches, requestOptions);
    } catch (error: any) {
      this.handleConfigError(error);
    }
  }

  /**
   * Update a specific configuration value using JSON patch
   */
  async updateConfigValue (path: string, value: unknown): Promise<void> {
    const patch: ConfigPatchOperation[] = [{
      op: 'replace',
      path,
      value
    }];

    await this.patchConfiguration(patch);
  }

  /**
   * Get device health status
   */
  async getHealth (): Promise<HealthResponse> {
    return this.httpClient.get<HealthResponse>('/api/health');
  }

  /**
   * Apply local patch to configuration object (for preview purposes)
   */
  previewPatch (config: Configuration, operations: ConfigPatchOperation[]): Configuration {
    const patches: Operation[] = operations.map(op => ({
      op: op.op,
      path: op.path,
      value: op.value,
      from: op.from
    } as Operation));

    // Create a deep copy and apply patch
    const configCopy = JSON.parse(JSON.stringify(config));
    const result = jsonpatch.applyPatch(configCopy, patches, false, false);

    // Check if any patches failed
    const hasErrors = result.some((r: any) => r && typeof r === 'object' && 'error' in r);
    if (hasErrors) {
      throw new Error('Patch preview failed: some operations were rejected');
    }

    return configCopy;
  }

  /**
   * Convenience methods for common configuration updates
   */

  /**
   * Update device name
   */
  async updateDeviceName (name: string): Promise<void> {
    if (!name || name.length === 0 || name.length > 32) {
      throw new Error('Device name must be between 1 and 32 characters');
    }

    await this.updateConfigValue('/device/name', name);
  }

  /**
   * Update device mode
   */
  async updateDeviceMode (mode: 'usb_otg' | 'uart'): Promise<void> {
    await this.updateConfigValue('/device/mode', mode);
  }

  /**
   * Update WiFi SSID
   */
  async updateWiFiSSID (ssid: string): Promise<void> {
    if (ssid.length > 32) {
      throw new Error('WiFi SSID must be 32 characters or less');
    }

    await this.updateConfigValue('/connection/wifi/ssid', ssid);
  }

  /**
   * Enable or disable WiFi auto-connect
   */
  async updateWiFiAutoConnect (autoConnect: boolean): Promise<void> {
    await this.updateConfigValue('/connection/wifi/autoConnect', autoConnect);
  }

  /**
   * Enable or disable RTCM
   */
  async updateRTCMEnabled (enabled: boolean): Promise<void> {
    await this.updateConfigValue('/rtcm/enabled', enabled);
  }

  /**
   * Update RTCM source configuration
   */
  async updateRTCMSource (
    type: 'ntrip' | 'tcp' | 'udp',
    host: string,
    port: number,
    options?: {
      mountpoint?: string;
      username?: string;
      password?: string;
    }
  ): Promise<void> {
    const patches: ConfigPatchOperation[] = [
      { op: 'replace', path: '/rtcm/source/type', value: type },
      { op: 'replace', path: '/rtcm/source/host', value: host },
      { op: 'replace', path: '/rtcm/source/port', value: port }
    ];

    if (options?.mountpoint !== undefined) {
      patches.push({ op: 'replace', path: '/rtcm/source/mountpoint', value: options.mountpoint });
    }

    if (options?.username !== undefined) {
      patches.push({ op: 'replace', path: '/rtcm/source/username', value: options.username });
    }

    if (options?.password !== undefined) {
      patches.push({ op: 'replace', path: '/rtcm/source/password', value: options.password });
    }

    await this.patchConfiguration(patches);
  }

  /**
   * Reset configuration to defaults
   */
  async resetToDefaults (): Promise<void> {
    const defaultConfig: Configuration = {
      version: 1,
      device: {
        name: 'ESP32-YardRover',
        mode: 'usb_otg'
      },
      connection: {
        type: 'wifi',
        wifi: {
          ssid: '',
          autoConnect: true
        }
      },
      rtcm: {
        enabled: false,
        source: {
          type: 'ntrip',
          host: '',
          port: 2101
        }
      }
    };

    await this.setConfiguration(defaultConfig);
  }

  /**
   * Validate configuration without applying it
   */
  validateConfiguration (config: Partial<Configuration>): string[] {
    return ConfigValidator.validateConfiguration(config);
  }

  /**
   * Get configuration with optimistic locking support
   */
  async getConfigurationWithVersion (): Promise<{ config: Configuration, version: number }> {
    const config = await this.getConfiguration();
    return { config, version: config.version };
  }

  /**
   * Update configuration with automatic retry on version conflict
   */
  async updateConfigurationWithRetry (
    updateFn: (config: Configuration) => Configuration,
    maxRetries: number = 3
  ): Promise<void> {
    let attempts = 0;

    while (attempts < maxRetries) {
      try {
        const { config: currentConfig, version } = await this.getConfigurationWithVersion();
        const updatedConfig = updateFn(currentConfig);

        await this.setConfiguration(updatedConfig, { expectedVersion: version });
        return; // Success
      } catch (error) {
        if (error instanceof VersionConflictError && attempts < maxRetries - 1) {
          attempts++;
          // Wait before retrying with exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 100));
          continue;
        }
        throw error; // Re-throw if not a version conflict or max retries reached
      }
    }
  }

  /**
   * Batch multiple configuration operations
   */
  async batchUpdate (operations: ConfigPatchOperation[], options?: ConfigUpdateOptions): Promise<void> {
    if (operations.length > 10) {
      // Split into chunks if too many operations
      const chunks = [];
      for (let i = 0; i < operations.length; i += 10) {
        chunks.push(operations.slice(i, i + 10));
      }

      for (const chunk of chunks) {
        await this.patchConfiguration(chunk, options);
        // Get updated version for subsequent chunks
        if (chunks.indexOf(chunk) < chunks.length - 1) {
          const { version } = await this.getConfigurationWithVersion();
          options = { ...options, expectedVersion: version };
        }
      }
    } else {
      await this.patchConfiguration(operations, options);
    }
  }

  /**
   * Create a patch from configuration differences
   */
  createConfigurationPatch (oldConfig: Configuration, newConfig: Configuration): ConfigPatchOperation[] {
    const patches: ConfigPatchOperation[] = [];

    // Simple implementation - in practice you might want to use a more sophisticated diffing library
    if (oldConfig.device.name !== newConfig.device.name) {
      patches.push({ op: 'replace', path: '/device/name', value: newConfig.device.name });
    }

    if (oldConfig.device.mode !== newConfig.device.mode) {
      patches.push({ op: 'replace', path: '/device/mode', value: newConfig.device.mode });
    }

    if (oldConfig.connection.type !== newConfig.connection.type) {
      patches.push({ op: 'replace', path: '/connection/type', value: newConfig.connection.type });
    }

    if (oldConfig.connection.wifi.ssid !== newConfig.connection.wifi.ssid) {
      patches.push({ op: 'replace', path: '/connection/wifi/ssid', value: newConfig.connection.wifi.ssid });
    }

    if (oldConfig.connection.wifi.autoConnect !== newConfig.connection.wifi.autoConnect) {
      patches.push({ op: 'replace', path: '/connection/wifi/autoConnect', value: newConfig.connection.wifi.autoConnect });
    }

    if (oldConfig.rtcm.enabled !== newConfig.rtcm.enabled) {
      patches.push({ op: 'replace', path: '/rtcm/enabled', value: newConfig.rtcm.enabled });
    }

    if (oldConfig.rtcm.source.type !== newConfig.rtcm.source.type) {
      patches.push({ op: 'replace', path: '/rtcm/source/type', value: newConfig.rtcm.source.type });
    }

    if (oldConfig.rtcm.source.host !== newConfig.rtcm.source.host) {
      patches.push({ op: 'replace', path: '/rtcm/source/host', value: newConfig.rtcm.source.host });
    }

    if (oldConfig.rtcm.source.port !== newConfig.rtcm.source.port) {
      patches.push({ op: 'replace', path: '/rtcm/source/port', value: newConfig.rtcm.source.port });
    }

    return patches;
  }

  /**
   * Handle configuration-specific errors
   */
  private handleConfigError (error: any): never {
    if (error instanceof HttpError) {
      if (error.status === 409) {
        throw new VersionConflictError(0, 0, 'Configuration was modified by another client');
      } else if (error.status === 507) {
        throw new StorageError('Insufficient storage space');
      } else if (error.status === 400) {
        throw new ConfigValidationError([error.message]);
      }
    }

    throw error; // Re-throw if not a known configuration error
  }
}
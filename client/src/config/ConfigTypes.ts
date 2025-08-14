/**
 * TypeScript interfaces matching the ESP32 configuration structures
 */

/**
 * Device configuration
 */
export interface DeviceConfig {
  name: string;
  mode: 'usb_otg' | 'uart';
}

/**
 * WiFi configuration
 */
export interface WiFiConfig {
  ssid: string;
  autoConnect: boolean;
}

/**
 * Connection configuration
 */
export interface ConnectionConfig {
  type: 'wifi' | 'ethernet';
  wifi: WiFiConfig;
}

/**
 * RTCM source configuration
 */
export interface RTCMSourceConfig {
  type: 'ntrip' | 'tcp' | 'udp';
  host: string;
  port: number;
  mountpoint?: string;
  username?: string;
  password?: string;
}

/**
 * RTCM configuration
 */
export interface RTCMConfig {
  enabled: boolean;
  source: RTCMSourceConfig;
}

/**
 * Complete device configuration
 */
export interface Configuration {
  version: number;
  device: DeviceConfig;
  connection: ConnectionConfig;
  rtcm: RTCMConfig;
}

/**
 * WiFi credentials for connection
 */
export interface WiFiCredentials {
  ssid: string;
  password: string;
}

/**
 * Health status response
 */
export interface HealthResponse {
  status: 'healthy' | 'degraded';
  uptime: number;
  freeHeap: number;
}

/**
 * Configuration validation result
 */
export enum ConfigValidationResult {
  VALID = 'valid',
  INVALID_DEVICE_NAME = 'invalid_device_name',
  INVALID_DEVICE_MODE = 'invalid_device_mode',
  INVALID_CONNECTION_TYPE = 'invalid_connection_type',
  INVALID_WIFI_SSID = 'invalid_wifi_ssid',
  INVALID_RTCM_SOURCE_TYPE = 'invalid_rtcm_source_type',
  INVALID_RTCM_HOST = 'invalid_rtcm_host',
  INVALID_RTCM_PORT = 'invalid_rtcm_port',
  INVALID_JSON_STRUCTURE = 'invalid_json_structure',
  VERSION_CONFLICT = 'version_conflict',
  STORAGE_ERROR = 'storage_error'
}

/**
 * Configuration patch operation (JSON Patch)
 */
export interface ConfigPatchOperation {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path: string;
  value?: unknown;
  from?: string;
}

/**
 * Configuration update options
 */
export interface ConfigUpdateOptions {
  /** Expected version for optimistic locking */
  expectedVersion?: number;
  /** Whether to validate before applying */
  validate?: boolean;
  /** Timeout for the operation in milliseconds */
  timeout?: number;
}

/**
 * Version conflict error
 */
export class VersionConflictError extends Error {
  constructor(
    public readonly expectedVersion: number,
    public readonly actualVersion: number,
    message?: string
  ) {
    super(message || `Version conflict: expected ${expectedVersion}, got ${actualVersion}`);
    this.name = 'VersionConflictError';
  }
}

/**
 * Configuration validation error
 */
export class ConfigValidationError extends Error {
  constructor(
    public readonly errors: string[],
    message?: string
  ) {
    super(message || `Configuration validation failed: ${errors.join(', ')}`);
    this.name = 'ConfigValidationError';
  }
}

/**
 * Storage error
 */
export class StorageError extends Error {
  constructor(message?: string) {
    super(message || 'Storage operation failed');
    this.name = 'StorageError';
  }
}

/**
 * Type guard functions
 */
export function isDeviceMode(value: string): value is DeviceConfig['mode'] {
  return value === 'usb_otg' || value === 'uart';
}

export function isConnectionType(value: string): value is ConnectionConfig['type'] {
  return value === 'wifi' || value === 'ethernet';
}

export function isRTCMSourceType(value: string): value is RTCMSourceConfig['type'] {
  return value === 'ntrip' || value === 'tcp' || value === 'udp';
}

export function isHealthStatus(value: string): value is HealthResponse['status'] {
  return value === 'healthy' || value === 'degraded';
}

/**
 * Configuration validation utilities
 */
export class ConfigValidator {
  static validateDeviceConfig(config: Partial<DeviceConfig>): string[] {
    const errors: string[] = [];
    
    if (!config.name || config.name.length === 0) {
      errors.push('Device name is required');
    } else if (config.name.length > 32) {
      errors.push('Device name must be 32 characters or less');
    }
    
    if (config.mode && !isDeviceMode(config.mode)) {
      errors.push('Device mode must be either "usb_otg" or "uart"');
    }
    
    return errors;
  }
  
  static validateConnectionConfig(config: Partial<ConnectionConfig>): string[] {
    const errors: string[] = [];
    
    if (config.type && !isConnectionType(config.type)) {
      errors.push('Connection type must be either "wifi" or "ethernet"');
    }
    
    if (config.type === 'wifi' && config.wifi) {
      if (!config.wifi.ssid || config.wifi.ssid.length === 0) {
        errors.push('WiFi SSID is required when using WiFi connection');
      } else if (config.wifi.ssid.length > 32) {
        errors.push('WiFi SSID must be 32 characters or less');
      }
    }
    
    return errors;
  }
  
  static validateRTCMConfig(config: Partial<RTCMConfig>): string[] {
    const errors: string[] = [];
    
    if (config.source) {
      if (config.source.type && !isRTCMSourceType(config.source.type)) {
        errors.push('RTCM source type must be "ntrip", "tcp", or "udp"');
      }
      
      if (config.enabled && (!config.source.host || config.source.host.length === 0)) {
        errors.push('RTCM host is required when RTCM is enabled');
      }
      
      if (config.source.port !== undefined && (config.source.port < 1 || config.source.port > 65535)) {
        errors.push('RTCM port must be between 1 and 65535');
      }
    }
    
    return errors;
  }
  
  static validateConfiguration(config: Partial<Configuration>): string[] {
    const errors: string[] = [];
    
    if (config.device) {
      errors.push(...this.validateDeviceConfig(config.device));
    }
    
    if (config.connection) {
      errors.push(...this.validateConnectionConfig(config.connection));
    }
    
    if (config.rtcm) {
      errors.push(...this.validateRTCMConfig(config.rtcm));
    }
    
    return errors;
  }
}
/**
 * Peripheral types and interfaces
 *
 * Mirrors backend peripheral models for type-safe API communication
 */

// ============================================================================
// Peripheral Types and Enums
// ============================================================================

export enum PeripheralType {
  // Mowing and lawn care
  MOWER = 'mower',
  GRASS_COLLECTOR = 'grass_collector',
  MULCHER = 'mulcher',
  EDGER = 'edger',
  AERATOR = 'aerator',
  SEEDER = 'seeder',

  // Snow and winter
  SNOW_BLOWER = 'snow_blower',
  SNOW_PLOW = 'snow_plow',
  SALT_SPREADER = 'salt_spreader',

  // Application and spraying
  SPRAYER = 'sprayer',
  FERTILIZER_SPREADER = 'fertilizer_spreader',

  // Collection and cleaning
  VACUUM = 'vacuum',
  LEAF_BLOWER = 'leaf_blower',
  DEBRIS_COLLECTOR = 'debris_collector',

  // Monitoring and sensors
  CAMERA = 'camera',
  ENVIRONMENTAL_SENSOR = 'environmental_sensor',
  SOIL_SENSOR = 'soil_sensor',
  LIDAR = 'lidar',

  // Utility
  POWER_MODULE = 'power_module',
  LIGHTING = 'lighting',
  TRAILER_HITCH = 'trailer_hitch',

  // Built-in features
  BUILTIN_GPS = 'builtin_gps',
  BUILTIN_IMU = 'builtin_imu',
  BUILTIN_BATTERY = 'builtin_battery',

  // Custom/other
  CUSTOM = 'custom'
}

export enum PeripheralState {
  DISCONNECTED = 'disconnected',
  CONNECTED = 'connected',
  INITIALIZING = 'initializing',
  READY = 'ready',
  ACTIVE = 'active',
  ERROR = 'error',
  DISABLED = 'disabled'
}

export enum PeripheralHealth {
  HEALTHY = 'healthy',
  WARNING = 'warning',
  ERROR = 'error',
  UNKNOWN = 'unknown'
}

// ============================================================================
// Peripheral Capability Models
// ============================================================================

export interface PeripheralCapability {
  operations: string[];
  power_required: number;
  voltage?: number;
  current_max?: number;
  communication_protocol: string;
  requires_calibration: boolean;
  telemetry_rate_hz: number;
}

export interface PeripheralCompatibilityRule {
  exclusive_with: PeripheralType[];
  requires: PeripheralType[];
  compatible_with: PeripheralType[];
  max_concurrent: number;
}

// ============================================================================
// Peripheral Metadata
// ============================================================================

export interface PeripheralMetadata {
  peripheral_id: string;
  type: PeripheralType;
  name: string;
  manufacturer: string;
  model: string;
  firmware_version: string;
  hardware_version: string;
  serial_number?: string;
  capabilities: PeripheralCapability;
  compatibility: PeripheralCompatibilityRule;
  description?: string;
}

// ============================================================================
// Peripheral Status and Telemetry
// ============================================================================

export interface PeripheralStatus {
  peripheral_id: string;
  state: PeripheralState;
  health: PeripheralHealth;
  enabled: boolean;
  active: boolean;
  error_message?: string;
  warning_message?: string;
  uptime_seconds: number;
  operation_hours: number;
  last_seen: string;
}

export interface PeripheralTelemetry {
  peripheral_id: string;
  timestamp: string;
  data: Record<string, any>;
}

// ============================================================================
// Peripheral Full Model
// ============================================================================

export interface Peripheral {
  metadata: PeripheralMetadata;
  status: PeripheralStatus;
  telemetry?: PeripheralTelemetry;
  created: string;
  lastModified: string;
}

// ============================================================================
// API Response Models
// ============================================================================

export interface PeripheralListResponse {
  peripherals: Peripheral[];
  count: number;
  connected_count: number;
  active_count: number;
}

export interface PeripheralOperationResponse {
  peripheral_id: string;
  status: 'success' | 'queued' | 'error';
  message?: string;
}

export interface PeripheralCommandRequest {
  command: string;
  parameters: Record<string, any>;
}

export interface CompatibilityCheckResponse {
  compatible: boolean;
  conflicts: Array<Record<string, any>>;
  warnings: string[];
}

export interface PeripheralStats {
  total_peripherals: number;
  connected_peripherals: number;
  enabled_peripherals: number;
  active_peripherals: number;
  total_connections: number;
  total_disconnections: number;
}

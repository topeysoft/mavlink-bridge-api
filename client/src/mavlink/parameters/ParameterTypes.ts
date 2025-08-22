/**
 * Core MAVLink parameter management types and interfaces
 */

export type ParameterDataType = 'int' | 'float' | 'enum' | 'bitmask';
export type ParameterUserLevel = 'Standard' | 'Advanced' | 'Expert';

export interface ParameterValue {
  name: string;
  value: number;
  type: ParameterDataType;
  timestamp?: number;
}

export interface ParameterRequest {
  parameterName?: string;
  parameterIndex?: number;
  targetSystem?: number;
  targetComponent?: number;
}

export interface ParameterSetRequest {
  parameterName: string;
  value: number;
  targetSystem?: number;
  targetComponent?: number;
}

export interface ParameterListRequest {
  targetSystem?: number;
  targetComponent?: number;
  startIndex?: number;
  count?: number;
}

export interface ParameterResponse {
  success: boolean;
  parameterName?: string;
  value?: number;
  totalCount?: number;
  index?: number;
  errorMessage?: string;
}

export interface ParameterStreamOptions {
  autoReconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  parameterFilter?: string[];
  categoryFilter?: string[];
  userLevelFilter?: ParameterUserLevel[];
}

export interface ParameterChangeEvent {
  type: 'parameter_changed' | 'parameter_added' | 'parameter_removed';
  parameterName: string;
  oldValue?: number;
  newValue?: number;
  timestamp: number;
}

export interface ParameterValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  normalizedValue?: number;
}

export interface ParameterPreset {
  id: string;
  name: string;
  description: string;
  category: string;
  userLevel: ParameterUserLevel;
  parameters: Record<string, number>;
  tags: string[];
  version: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ParameterBackup {
  id: string;
  name: string;
  description?: string;
  parameters: Record<string, number>;
  timestamp: number;
  vehicleType?: string;
  firmwareVersion?: string;
  checksum: string;
}

export interface ParameterDiff {
  added: ParameterValue[];
  removed: ParameterValue[];
  changed: Array<{
    name: string;
    oldValue: number;
    newValue: number;
  }>;
}

export interface ParameterSearchOptions {
  query: string;
  categories?: string[];
  userLevels?: ParameterUserLevel[];
  dataTypes?: ParameterDataType[];
  tags?: string[];
  hasValues?: boolean;
  hasRange?: boolean;
  modifiedOnly?: boolean;
  requiresReboot?: boolean;
  limit?: number;
  offset?: number;
}

export interface ParameterSearchResult {
  parameters: ParameterValue[];
  totalCount: number;
  hasMore: boolean;
}

export interface ParameterCache {
  parameters: Map<string, ParameterValue>;
  lastUpdated: number;
  isComplete: boolean;
  totalCount?: number;
}

export interface ParameterStats {
  totalParameters: number;
  modifiedParameters: number;
  categoryCounts: Record<string, number>;
  userLevelCounts: Record<ParameterUserLevel, number>;
  dataTypeCounts: Record<ParameterDataType, number>;
  lastUpdate: number;
}

// MAVLink parameter message types
export enum MAVLinkParameterType {
  UINT8 = 1,
  INT8 = 2,
  UINT16 = 3,
  INT16 = 4,
  UINT32 = 5,
  INT32 = 6,
  UINT64 = 7,
  INT64 = 8,
  REAL32 = 9,
  REAL64 = 10
}

export interface MAVLinkParameterValue {
  parameterName: string;
  parameterValue: number;
  parameterType: MAVLinkParameterType;
  parameterCount: number;
  parameterIndex: number;
  targetSystem: number;
  targetComponent: number;
}

export interface MAVLinkParameterSet {
  parameterName: string;
  parameterValue: number;
  parameterType: MAVLinkParameterType;
  targetSystem: number;
  targetComponent: number;
}

export interface MAVLinkParameterRequestRead {
  parameterName?: string;
  parameterIndex?: number;
  targetSystem: number;
  targetComponent: number;
}

export interface MAVLinkParameterRequestList {
  targetSystem: number;
  targetComponent: number;
}

// Error types
export class ParameterError extends Error {
  constructor(
    message: string,
    public parameterName?: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ParameterError';
  }
}

export class ParameterValidationError extends ParameterError {
  constructor(
    message: string,
    parameterName: string,
    public value: any,
    public validationErrors: string[]
  ) {
    super(message, parameterName, 'VALIDATION_ERROR');
    this.name = 'ParameterValidationError';
  }
}

export class ParameterNotFoundError extends ParameterError {
  constructor(parameterName: string) {
    super(`Parameter '${parameterName}' not found`, parameterName, 'NOT_FOUND');
    this.name = 'ParameterNotFoundError';
  }
}

export class ParameterTimeoutError extends ParameterError {
  constructor(operation: string, parameterName?: string) {
    super(`Parameter operation '${operation}' timed out`, parameterName, 'TIMEOUT');
    this.name = 'ParameterTimeoutError';
  }
}

// Utility types
export type ParameterListener = (event: ParameterChangeEvent) => void;
export type ParameterFilter = (parameter: ParameterValue) => boolean;
export type ParameterTransform<T> = (parameter: ParameterValue) => T;

// Constants
export const DEFAULT_PARAMETER_TIMEOUT = 5000; // 5 seconds
export const DEFAULT_STREAM_RECONNECT_DELAY = 1000; // 1 second
export const DEFAULT_MAX_RECONNECT_ATTEMPTS = 5;
export const PARAMETER_NAME_MAX_LENGTH = 16; // MAVLink specification limit
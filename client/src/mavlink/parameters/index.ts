/**
 * MAVLink Parameter Management
 * 
 * Comprehensive parameter management system with ArduPilot metadata,
 * validation, categorization, and real-time streaming support.
 */

// Core types and interfaces
export * from './ParameterTypes';

// Parameter validation and utilities
export { ParameterValidator, ParameterUtils } from './ParameterValidation';

// Generated parameter definitions from ArduPilot
export * from './ParameterDefinitions';

// Re-export commonly used types for convenience
export type {
  ParameterValue,
  ParameterRequest,
  ParameterSetRequest,
  ParameterListRequest,
  ParameterResponse,
  ParameterChangeEvent,
  ParameterValidationResult,
  ParameterPreset,
  ParameterBackup,
  ParameterSearchOptions,
  ParameterSearchResult,
  ParameterStats
} from './ParameterTypes';
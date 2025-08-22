/**
 * Parameter validation and utility functions
 */

import {
  ParameterDataType,
  ParameterValidationResult,
  ParameterValidationError,
  ParameterValue,
  MAVLinkParameterType,
  PARAMETER_NAME_MAX_LENGTH
} from './ParameterTypes';
import { getParameterDefinition } from './ParameterDefinitions';

export class ParameterValidator {
  /**
   * Validate a parameter value against its definition
   */
  static validateParameter(name: string, value: any): ParameterValidationResult {
    const result: ParameterValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    const definition = getParameterDefinition(name);
    if (!definition) {
      result.valid = false;
      result.errors.push(`Parameter '${name}' not found in definitions`);
      return result;
    }

    // Validate parameter name length
    if (name.length > PARAMETER_NAME_MAX_LENGTH) {
      result.errors.push(`Parameter name exceeds maximum length of ${PARAMETER_NAME_MAX_LENGTH} characters`);
      result.valid = false;
    }

    // Type validation and conversion
    const typeValidation = this.validateType(value, definition.dataType);
    if (!typeValidation.valid) {
      result.errors.push(...typeValidation.errors);
      result.valid = false;
    } else if (typeValidation.normalizedValue !== undefined) {
      result.normalizedValue = typeValidation.normalizedValue;
    }

    // Range validation
    if (definition.range && result.normalizedValue !== undefined) {
      const rangeValidation = this.validateRange(result.normalizedValue, definition.range);
      if (!rangeValidation.valid) {
        result.errors.push(...rangeValidation.errors);
        result.valid = false;
      }
      result.warnings.push(...rangeValidation.warnings);
    }

    // Enum validation
    if (definition.values && result.normalizedValue !== undefined) {
      const enumValidation = this.validateEnum(result.normalizedValue, definition.values);
      if (!enumValidation.valid) {
        result.errors.push(...enumValidation.errors);
        result.valid = false;
      }
    }

    // Bitmask validation
    if (definition.bitmask && result.normalizedValue !== undefined) {
      const bitmaskValidation = this.validateBitmask(result.normalizedValue, definition.bitmask);
      if (!bitmaskValidation.valid) {
        result.errors.push(...bitmaskValidation.errors);
        result.valid = false;
      }
      result.warnings.push(...bitmaskValidation.warnings);
    }

    // Increment validation
    if (definition.increment && result.normalizedValue !== undefined) {
      const incrementValidation = this.validateIncrement(result.normalizedValue, definition.increment);
      if (!incrementValidation.valid) {
        result.warnings.push(...incrementValidation.warnings);
      }
    }

    return result;
  }

  /**
   * Validate parameter data type
   */
  private static validateType(value: any, dataType: ParameterDataType): ParameterValidationResult {
    const result: ParameterValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    if (value === null || value === undefined) {
      result.valid = false;
      result.errors.push('Value cannot be null or undefined');
      return result;
    }

    const numValue = Number(value);
    if (isNaN(numValue)) {
      result.valid = false;
      result.errors.push('Value must be a valid number');
      return result;
    }

    switch (dataType) {
      case 'int':
        if (!Number.isInteger(numValue)) {
          result.valid = false;
          result.errors.push('Value must be an integer');
        } else {
          result.normalizedValue = Math.round(numValue);
        }
        break;

      case 'float':
        result.normalizedValue = numValue;
        break;

      case 'enum':
        if (!Number.isInteger(numValue)) {
          result.valid = false;
          result.errors.push('Enum value must be an integer');
        } else {
          result.normalizedValue = Math.round(numValue);
        }
        break;

      case 'bitmask':
        if (!Number.isInteger(numValue) || numValue < 0) {
          result.valid = false;
          result.errors.push('Bitmask value must be a non-negative integer');
        } else {
          result.normalizedValue = Math.round(numValue);
        }
        break;

      default:
        result.valid = false;
        result.errors.push(`Unknown data type: ${dataType}`);
    }

    return result;
  }

  /**
   * Validate parameter value range
   */
  private static validateRange(value: number, range: { min: number; max: number }): ParameterValidationResult {
    const result: ParameterValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    if (value < range.min) {
      result.valid = false;
      result.errors.push(`Value ${value} is below minimum ${range.min}`);
    } else if (value > range.max) {
      result.valid = false;
      result.errors.push(`Value ${value} is above maximum ${range.max}`);
    }

    // Warn if value is very close to limits
    const rangeSize = range.max - range.min;
    const tolerance = rangeSize * 0.05; // 5% of range
    
    if (value <= range.min + tolerance) {
      result.warnings.push(`Value ${value} is very close to minimum limit ${range.min}`);
    } else if (value >= range.max - tolerance) {
      result.warnings.push(`Value ${value} is very close to maximum limit ${range.max}`);
    }

    return result;
  }

  /**
   * Validate enum value
   */
  private static validateEnum(value: number, enumValues: Record<string, string>): ParameterValidationResult {
    const result: ParameterValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    const validValues = Object.keys(enumValues).map(Number);
    if (!validValues.includes(value)) {
      result.valid = false;
      result.errors.push(`Value ${value} is not a valid enum option. Valid values: ${validValues.join(', ')}`);
    }

    return result;
  }

  /**
   * Validate bitmask value
   */
  private static validateBitmask(value: number, bitmask: Record<string, string>): ParameterValidationResult {
    const result: ParameterValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    const validBits = Object.keys(bitmask).map(Number);
    const maxBit = Math.max(...validBits);
    const maxValue = (1 << (maxBit + 1)) - 1;

    if (value > maxValue) {
      result.valid = false;
      result.errors.push(`Bitmask value ${value} exceeds maximum valid value ${maxValue}`);
    }

    // Check for unused bits
    const usedBits = validBits.reduce((mask, bit) => mask | (1 << bit), 0);
    const unusedBits = value & ~usedBits;
    if (unusedBits > 0) {
      result.warnings.push(`Bitmask value ${value} includes unused bits`);
    }

    return result;
  }

  /**
   * Validate increment value
   */
  private static validateIncrement(value: number, increment: number): ParameterValidationResult {
    const result: ParameterValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    const remainder = value % increment;
    if (Math.abs(remainder) > 1e-10) { // Account for floating point precision
      result.warnings.push(`Value ${value} is not a multiple of increment ${increment}. Suggested: ${value - remainder} or ${value - remainder + increment}`);
    }

    return result;
  }

  /**
   * Convert JavaScript value to MAVLink parameter type
   */
  static inferMAVLinkType(value: number, dataType: ParameterDataType): MAVLinkParameterType {
    switch (dataType) {
      case 'int':
      case 'enum':
      case 'bitmask':
        if (value >= 0 && value <= 255) return MAVLinkParameterType.UINT8;
        if (value >= -128 && value <= 127) return MAVLinkParameterType.INT8;
        if (value >= 0 && value <= 65535) return MAVLinkParameterType.UINT16;
        if (value >= -32768 && value <= 32767) return MAVLinkParameterType.INT16;
        if (value >= 0 && value <= 4294967295) return MAVLinkParameterType.UINT32;
        return MAVLinkParameterType.INT32;
      
      case 'float':
        return MAVLinkParameterType.REAL32;
      
      default:
        return MAVLinkParameterType.REAL32;
    }
  }

  /**
   * Batch validate multiple parameters
   */
  static validateParameters(parameters: Record<string, any>): Record<string, ParameterValidationResult> {
    const results: Record<string, ParameterValidationResult> = {};
    
    for (const [name, value] of Object.entries(parameters)) {
      results[name] = this.validateParameter(name, value);
    }
    
    return results;
  }

  /**
   * Check if any parameters require reboot
   */
  static checkRebootRequired(parameterNames: string[]): boolean {
    return parameterNames.some(name => {
      const definition = getParameterDefinition(name);
      return definition?.rebootRequired === true;
    });
  }

  /**
   * Get parameter dependencies and warnings
   */
  static getParameterWarnings(name: string, value: number): string[] {
    const warnings: string[] = [];
    const definition = getParameterDefinition(name);
    
    if (!definition) return warnings;

    // Add reboot warning
    if (definition.rebootRequired) {
      warnings.push('This parameter requires a reboot to take effect');
    }

    // Add safety warnings for critical parameters
    if (definition.tags.includes('safety') || definition.tags.includes('arming')) {
      warnings.push('This is a safety-critical parameter. Use caution when modifying.');
    }

    // Add performance warnings
    if (definition.tags.includes('performance') || definition.tags.includes('tuning')) {
      warnings.push('This parameter affects flight performance. Test thoroughly after changes.');
    }

    return warnings;
  }
}

/**
 * Parameter conversion utilities
 */
export class ParameterUtils {
  /**
   * Format parameter value for display
   */
  static formatValue(value: number, definition?: any): string {
    if (!definition) return value.toString();

    // Format based on data type
    if (definition.dataType === 'float') {
      const precision = definition.increment ? 
        Math.max(0, -Math.floor(Math.log10(definition.increment))) : 2;
      return value.toFixed(precision);
    }

    // Format enum values
    if (definition.values && definition.values[value]) {
      return `${value} (${definition.values[value]})`;
    }

    // Format bitmask values
    if (definition.bitmask) {
      const activeFlags = Object.entries(definition.bitmask)
        .filter(([bit]) => (value & (1 << parseInt(bit))) !== 0)
        .map(([, name]) => name);
      
      if (activeFlags.length > 0) {
        return `${value} (${activeFlags.join(', ')})`;
      }
    }

    return value.toString();
  }

  /**
   * Get unit symbol for parameter
   */
  static getUnitSymbol(units?: string): string {
    if (!units) return '';
    
    const unitMap: Record<string, string> = {
      'meters': 'm',
      'centimeters': 'cm',
      'degrees': '°',
      'radians': 'rad',
      'seconds': 's',
      'milliseconds': 'ms',
      'percent': '%',
      'volts': 'V',
      'amperes': 'A',
      'hertz': 'Hz',
      'meters/second': 'm/s',
      'degrees/second': '°/s'
    };
    
    return unitMap[units.toLowerCase()] || units;
  }

  /**
   * Calculate parameter checksum for backup verification
   */
  static calculateChecksum(parameters: Record<string, number>): string {
    const sorted = Object.keys(parameters).sort();
    const data = sorted.map(key => `${key}=${parameters[key]}`).join('|');
    
    // Simple hash function for checksum
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16);
  }
}
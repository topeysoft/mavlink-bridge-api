// Parameter Type Definitions for YardRover

export enum ParameterType {
  INT8 = 'int8',
  INT16 = 'int16',
  INT32 = 'int32',
  UINT8 = 'uint8',
  UINT16 = 'uint16',
  UINT32 = 'uint32',
  FLOAT = 'float',
  DOUBLE = 'double',
}

export interface Parameter {
  name: string
  displayName: string
  value: number
  defaultValue: number
  type: ParameterType
  group: string
  description: string
  units?: string
  min?: number
  max?: number
  increment?: number
  readOnly?: boolean
  rebootRequired?: boolean
  modified?: boolean
  // For MAVLink
  paramIndex?: number
  paramId?: string
}

export interface ParameterGroup {
  name: string
  displayName: string
  description: string
  icon?: string
  parameters: Parameter[]
}

export interface ParameterSet {
  id: string
  name: string
  description?: string
  created: string
  lastModified: string
  parameters: Record<string, number> // paramName -> value
}

export interface ParameterFilter {
  search: string
  group?: string
  modifiedOnly: boolean
  showAdvanced: boolean
}

export interface ParameterValidation {
  valid: boolean
  errors: string[]
  warnings: string[]
}

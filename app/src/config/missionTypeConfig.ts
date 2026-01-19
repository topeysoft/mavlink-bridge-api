/**
 * Mission Type Configuration
 *
 * Central configuration mapping mission template categories to their
 * allowed path patterns, visualization modes, and display colors.
 */

import type { PatternType } from '@/composables/useMissionPathGeneration'

// Mirror of backend TemplateCategory enum
export type TemplateCategory =
  | 'lawn_care'
  | 'fertilization'
  | 'irrigation'
  | 'winter'
  | 'cleanup'
  | 'security'
  | 'monitoring'
  | 'utility'
  | 'seasonal'
  | 'smart'

export type PathVisualization = 'strips' | 'line' | 'waypoints' | 'coverage'

export interface MissionTypeConfig {
  /** Template category this config applies to */
  category: TemplateCategory
  /** Path patterns available for this category */
  allowedPatterns: PatternType[]
  /** Default pattern when none specified */
  defaultPattern: PatternType
  /** How to render the path preview on the map */
  pathVisualization: PathVisualization
  /** Whether this category supports perimeter-first option */
  supportsPerimeterFirst: boolean
  /** Colors for strip visualization (even/odd passes) */
  stripColors: { even: string; odd: string }
  /** Color for line/coverage visualization */
  primaryColor: string
  /** Type-specific control component to show (if any) */
  controlComponent: 'mowing' | 'snow' | 'spraying' | 'patrol' | 'collection' | 'watering' | null
}

/**
 * Configuration matrix for all template categories
 */
export const MISSION_TYPE_CONFIGS: Record<TemplateCategory, MissionTypeConfig> = {
  lawn_care: {
    category: 'lawn_care',
    allowedPatterns: ['stripe', 'spiral', 'checkerboard', 'perimeter'],
    defaultPattern: 'stripe',
    pathVisualization: 'strips',
    supportsPerimeterFirst: true,
    stripColors: { even: '#4a7c3f', odd: '#6b9b5a' }, // Dark/light grass green
    primaryColor: '#2C5F2D',
    controlComponent: 'mowing'
  },

  winter: {
    category: 'winter',
    allowedPatterns: ['stripe', 'perimeter'], // No spiral - inefficient for plowing
    defaultPattern: 'stripe',
    pathVisualization: 'strips',
    supportsPerimeterFirst: false,
    stripColors: { even: '#a8d4e6', odd: '#c8e6f4' }, // Blue/white snow
    primaryColor: '#87CEEB',
    controlComponent: 'snow'
  },

  security: {
    category: 'security',
    allowedPatterns: ['perimeter'], // Patrol is perimeter + waypoints only
    defaultPattern: 'perimeter',
    pathVisualization: 'waypoints',
    supportsPerimeterFirst: false,
    stripColors: { even: '#3498db', odd: '#5dade2' },
    primaryColor: '#3498db',
    controlComponent: 'patrol'
  },

  fertilization: {
    category: 'fertilization',
    allowedPatterns: ['stripe', 'checkerboard'], // Even coverage patterns
    defaultPattern: 'stripe',
    pathVisualization: 'coverage',
    supportsPerimeterFirst: false,
    stripColors: { even: '#7CB342', odd: '#9CCC65' },
    primaryColor: '#7CB342',
    controlComponent: 'spraying'
  },

  cleanup: {
    category: 'cleanup',
    allowedPatterns: ['stripe', 'spiral'], // Thorough coverage
    defaultPattern: 'spiral',
    pathVisualization: 'strips',
    supportsPerimeterFirst: true,
    stripColors: { even: '#8D6E63', odd: '#A1887F' }, // Brown leaves
    primaryColor: '#8D6E63',
    controlComponent: 'collection'
  },

  irrigation: {
    category: 'irrigation',
    allowedPatterns: ['stripe', 'checkerboard'],
    defaultPattern: 'stripe',
    pathVisualization: 'coverage',
    supportsPerimeterFirst: false,
    stripColors: { even: '#2196F3', odd: '#64B5F6' },
    primaryColor: '#3498db',
    controlComponent: 'watering'
  },

  monitoring: {
    category: 'monitoring',
    allowedPatterns: ['stripe', 'spiral', 'perimeter'],
    defaultPattern: 'stripe',
    pathVisualization: 'line',
    supportsPerimeterFirst: false,
    stripColors: { even: '#9C27B0', odd: '#BA68C8' },
    primaryColor: '#9C27B0',
    controlComponent: null
  },

  utility: {
    category: 'utility',
    allowedPatterns: ['perimeter', 'stripe'],
    defaultPattern: 'perimeter',
    pathVisualization: 'line',
    supportsPerimeterFirst: false,
    stripColors: { even: '#607D8B', odd: '#90A4AE' },
    primaryColor: '#607D8B',
    controlComponent: null
  },

  seasonal: {
    category: 'seasonal',
    allowedPatterns: ['stripe', 'spiral', 'checkerboard'],
    defaultPattern: 'stripe',
    pathVisualization: 'strips',
    supportsPerimeterFirst: true,
    stripColors: { even: '#4a7c3f', odd: '#6b9b5a' }, // Same as lawn care
    primaryColor: '#2C5F2D',
    controlComponent: 'mowing'
  },

  smart: {
    category: 'smart',
    allowedPatterns: ['stripe', 'spiral', 'checkerboard'],
    defaultPattern: 'stripe',
    pathVisualization: 'strips',
    supportsPerimeterFirst: true,
    stripColors: { even: '#4a7c3f', odd: '#6b9b5a' }, // Same as lawn care
    primaryColor: '#2C5F2D',
    controlComponent: 'mowing'
  }
}

/**
 * Get configuration for a template category
 * Falls back to lawn_care config for unknown categories
 */
export function getMissionTypeConfig(category: TemplateCategory | string | undefined): MissionTypeConfig {
  if (!category) {
    return MISSION_TYPE_CONFIGS.lawn_care
  }

  const config = MISSION_TYPE_CONFIGS[category as TemplateCategory]
  if (!config) {
    console.warn(`Unknown template category: ${category}, falling back to lawn_care`)
    return MISSION_TYPE_CONFIGS.lawn_care
  }

  return config
}

/**
 * Check if a pattern is allowed for a given category
 */
export function isPatternAllowed(category: TemplateCategory | string | undefined, pattern: PatternType): boolean {
  const config = getMissionTypeConfig(category)
  return config.allowedPatterns.includes(pattern)
}

/**
 * Get default pattern for a category
 */
export function getDefaultPattern(category: TemplateCategory | string | undefined): PatternType {
  const config = getMissionTypeConfig(category)
  return config.defaultPattern
}

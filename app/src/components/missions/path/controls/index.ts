/**
 * Type-Specific Mission Controls
 *
 * Components for configuring mission-specific settings based on template category.
 */

export { default as MowingControls } from './MowingControls.vue'
export { default as SnowControls } from './SnowControls.vue'
export { default as SprayingControls } from './SprayingControls.vue'
export { default as PatrolControls } from './PatrolControls.vue'
export { default as CollectionControls } from './CollectionControls.vue'
export { default as WateringControls } from './WateringControls.vue'

/**
 * Type-specific settings interface
 * Matches backend TemplateDefaultSettings fields
 */
export interface TypeSpecificSettings {
  // Mowing
  mowing_height?: number
  edge_mode?: 'normal' | 'precise' | 'skip'

  // Snow
  clearing_height?: number
  salt_application?: boolean
  multi_pass?: boolean

  // Spraying
  spray_rate?: number

  // Patrol
  dwell_time?: number
  motion_detection?: boolean
  recording?: boolean

  // Collection
  collection_enabled?: boolean
  collection_mode?: 'vacuum' | 'blow' | 'rake'

  // Watering
  flow_rate?: number
  duration_per_zone?: number
}

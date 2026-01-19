/**
 * Mission Template types and interfaces
 *
 * Mirrors backend mission template models for type-safe API communication.
 * Templates provide pre-configured starting points for creating missions.
 */

import { PeripheralType } from '../peripherals/PeripheralTypes';
import { ZoneType } from '../resources/ResourceTypes';

// ============================================================================
// Template Enums
// ============================================================================

export enum TemplateCategory {
  LAWN_CARE = 'lawn_care',
  FERTILIZATION = 'fertilization',
  IRRIGATION = 'irrigation',
  WINTER = 'winter',
  CLEANUP = 'cleanup',
  SECURITY = 'security',
  MONITORING = 'monitoring',
  UTILITY = 'utility',
  SEASONAL = 'seasonal',
  SMART = 'smart'
}

export type UserMode = 'consumer' | 'power-user' | 'developer';

export type MissionScheduleType = 'once' | 'daily' | 'weekly' | 'monthly';

export type MissionPriority = 'low' | 'normal' | 'high' | 'critical';

// ============================================================================
// Weather Constraints
// ============================================================================

export interface WeatherConstraints {
  max_wind_speed: number;
  max_rain_rate: number;
  max_snow_rate: number;
  min_visibility: number;
  min_temp: number;
  max_temp: number;
  avoid_conditions: string[];
  require_dry_ground: boolean;
  dry_ground_hours: number;
  require_daylight: boolean;
}

// ============================================================================
// Template Default Settings
// ============================================================================

export interface TemplateDefaultSettings {
  // Mowing settings
  mowing_height?: number;
  mowing_pattern?: 'stripe' | 'spiral' | 'random' | 'checkerboard';
  edge_mode?: 'normal' | 'precise' | 'skip';
  overlap_percentage: number;

  // Speed and movement
  speed_mode: 'slow' | 'normal' | 'fast';

  // Collection
  collection_enabled: boolean;

  // Application settings
  spray_rate?: number;
  spread_rate?: number;

  // Snow settings
  clearing_height?: number;
  salt_application: boolean;

  // Patrol settings
  dwell_time?: number;
  motion_detection: boolean;
  recording: boolean;
}

// ============================================================================
// Mission Template
// ============================================================================

export interface MissionTemplate {
  id: string;
  name: string;
  consumer_name: string;
  description: string;
  consumer_description: string;
  emoji: string;
  category: TemplateCategory;

  // Requirements
  required_peripherals: PeripheralType[];
  optional_peripherals: PeripheralType[];
  compatible_zone_types: ZoneType[];

  // Weather constraints
  weather_constraints: WeatherConstraints;

  // Defaults
  default_settings: TemplateDefaultSettings;
  estimated_time_per_acre: number;
  default_schedule_type: MissionScheduleType;
  default_priority: MissionPriority;

  // Access control
  required_feature: string | null;
  min_user_mode: UserMode;

  // Seasonal constraints
  seasons: string[] | null;
}

// ============================================================================
// API Response Models
// ============================================================================

export interface MissionTemplateSummary {
  id: string;
  name: string;
  consumer_name: string;
  description: string;
  consumer_description: string;
  emoji: string;
  category: TemplateCategory;
  estimated_time_per_acre: number;
  available: boolean;
  unavailable_reason?: string;
}

export interface TemplateCategoryInfo {
  category: TemplateCategory;
  name: string;
  consumer_name: string;
  emoji: string;
  template_count: number;
  available_count: number;
}

export interface MissionTemplateListResponse {
  templates: MissionTemplateSummary[];
  categories: TemplateCategoryInfo[];
  total_count: number;
  available_count: number;
}

// ============================================================================
// Peripheral Availability
// ============================================================================

export interface PeripheralRequirement {
  peripheral_type: PeripheralType;
  required: boolean;
  available: boolean;
  peripheral_id?: string;
  peripheral_name?: string;
}

export interface PeripheralAvailabilityStatus {
  all_required_available: boolean;
  required: PeripheralRequirement[];
  optional: PeripheralRequirement[];
}

// ============================================================================
// Weather Models
// ============================================================================

export interface WeatherSummary {
  temperature: number;
  wind_speed: number;
  condition: string;
  rain_rate?: number;
  visibility?: number;
  hours_since_rain?: number;
}

export interface WeatherCheckResult {
  suitable: boolean;
  reasons: string[];
  current_conditions?: WeatherSummary;
}

export interface SuggestedTimeSlot {
  start_time: string;
  end_time: string;
  weather_score: number;
  conditions_summary: string;
}

export interface SuggestedSchedule {
  best_time?: SuggestedTimeSlot;
  alternative_times: SuggestedTimeSlot[];
}

export interface WeatherCheckResponse {
  suitable: boolean;
  current_conditions?: WeatherSummary;
  reasons: string[];
  suggested_times: SuggestedTimeSlot[];
}

// ============================================================================
// Zone Summary
// ============================================================================

export interface ZoneSummary {
  id: string;
  name: string;
  type: ZoneType;
  area: number;
}

// ============================================================================
// Template Detail Response
// ============================================================================

export interface MissionTemplateDetail {
  template: MissionTemplate;
  weather_status: WeatherCheckResult;
  peripheral_status: PeripheralAvailabilityStatus;
  compatible_zones: ZoneSummary[];
  suggested_schedule?: SuggestedSchedule;
}

// ============================================================================
// Create Mission from Template
// ============================================================================

export interface MissionFromTemplateRequest {
  name?: string;
  zone_ids: string[];
  schedule_type: MissionScheduleType;
  start_time: string;
  end_time?: string;
  days_of_week?: number[];
  day_of_month?: number;
  priority?: MissionPriority;
  settings_overrides?: Record<string, any>;
  weather_override?: boolean;
}

export interface MissionOperationResponse {
  id: string;
  status: 'queued' | 'success';
}

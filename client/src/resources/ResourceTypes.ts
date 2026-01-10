/**
 * Resource Types for persistent storage with multi-instance sync
 */

export enum ResourceType {
  ZONE = 0,
  MISSION = 1,
  USER_SETTINGS = 2
}

export interface ResourceMetadata {
  id: string;
  version: number;
  timestamp: number;
  type: ResourceType;
  checksum: number;
  size: number;
}

export interface SyncStatus {
  status: 'synced' | 'syncing' | 'offline' | 'conflict' | 'error';
  lastSync: number;
  pendingChanges: number;
  error?: string;
}

export interface ResourceListResponse {
  zones?: ResourceMetadata[];
  missions?: ResourceMetadata[];
  deleted?: string[];
  version: number;
  count: number;
}

export interface ResourceChangeEvent {
  id: string;
  type: ResourceType;
  data: any;
  timestamp: number;
}

export type ZoneType =
  | 'mowing'
  | 'exclusion'
  | 'charging'
  | 'patrol'
  | 'snow_clearing'
  | 'staging'
  | 'spraying'
  | 'watering'
  | 'collection'
  | 'monitoring';

export interface Zone {
  id: string;
  name: string;
  type: ZoneType;
  coordinates: Array<[number, number]>;
  color: string;
  area: number;
  description?: string;
  tags?: string[];
  created: string;
  lastModified: string;
  settings?: Record<string, any>;
}

// ScheduledMission - matches API spec (api-spec.yaml lines 2545-2618)
export interface Mission {
  id: string;
  name: string;
  type: 'once' | 'daily' | 'weekly' | 'monthly';
  zoneIds: string[];  // Array of zone IDs to execute in order
  schedule: {
    startTime: string;  // ISO 8601 date-time
    endTime?: string;   // Optional end time for recurring missions
    daysOfWeek?: number[];  // Days of week (0=Sunday, 6=Saturday) for weekly missions
    dayOfMonth?: number;    // Day of month (1-31) for monthly missions
  };
  priority: 'low' | 'normal' | 'high' | 'critical';
  enabled: boolean;
  created: string;
  lastModified: string;
  lastRun?: string;
  nextRun?: string;
}

export type ResourceData = Zone | Mission;

export interface ResourceStorageConfig {
  dbName: string;
  dbVersion: number;
  storeName: string;
  syncInterval?: number;  // Auto-sync interval in ms (0 = disabled)
  conflictResolution?: 'server-wins' | 'client-wins' | 'manual';
}

/**
 * Activity Log Types
 * Data models for activity logging, analysis, and visualization
 */

export interface LogEntry {
  id: string;
  timestamp: number;
  mode: string;
  latitude: number;
  longitude: number;
  altitude: number;
  groundSpeed: number;
  heading: number;
  batteryVoltage: number;
  batteryPercent: number;
  current: number;
  throttle: number;
  satellites: number;
  gpsFixType: number;
  hdop: number;
}

export interface SessionLog {
  id: string;
  name: string;
  vehicleId: string;
  startTime: number;
  endTime: number;
  duration: number;
  entries: LogEntry[];
  metadata: LogMetadata;
  statistics: LogStatistics;
}

export interface LogMetadata {
  firmwareVersion: string;
  vehicleType: string;
  modes: string[];
  totalDistance: number;
  maxAltitude: number;
  maxSpeed: number;
  startLocation: { lat: number; lon: number };
  endLocation: { lat: number; lon: number };
}

export interface LogStatistics {
  sessionTime: number;
  distanceTraveled: number;
  maxAltitude: number;
  avgAltitude: number;
  maxSpeed: number;
  avgSpeed: number;
  maxBatteryVoltage: number;
  minBatteryVoltage: number;
  avgBatteryVoltage: number;
  totalEnergyUsed: number;
  maxCurrent: number;
  avgCurrent: number;
  satelliteCount: {
    min: number;
    max: number;
    avg: number;
  };
}

export interface LogFilter {
  startDate?: number;
  endDate?: number;
  vehicleId?: string;
  minDuration?: number;
  maxDuration?: number;
  mode?: string;
  searchTerm?: string;
}

export interface LogExportFormat {
  type: 'csv' | 'kml' | 'geojson' | 'json';
  includeMetadata: boolean;
  includeStatistics: boolean;
  fields?: string[];
}

export interface LogTimelineEvent {
  timestamp: number;
  type: 'mode_change' | 'start' | 'stop' | 'warning' | 'error' | 'waypoint';
  description: string;
  severity?: 'info' | 'warning' | 'error';
  data?: Record<string, unknown>;
}

export interface LogChartData {
  timestamp: number;
  value: number;
}

export interface LogChartSeries {
  name: string;
  data: LogChartData[];
  color?: string;
  unit?: string;
}

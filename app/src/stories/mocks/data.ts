import type { SavedDevice } from '@/stores/devices';
import type { SystemHealth } from '@/stores/health';
import type { ActivityEvent } from '@/stores/activity';

// Mock saved devices
export const mockDevices: SavedDevice[] = [
  {
    url: 'http://yardrover-001.local',
    name: 'YardRover Alpha',
    lastConnected: new Date().getTime() - 3600000, // 1 hour ago
  },
  {
    url: 'http://yardrover-002.local',
    name: 'YardRover Beta',
    lastConnected: new Date().getTime() - 86400000, // 1 day ago
  },
  {
    url: 'http://192.168.1.100:8080',
    name: 'Test Device',
    lastConnected: new Date().getTime() - 604800000, // 1 week ago
  },
];

// Mock system health data
export const mockSystemHealth: SystemHealth = {
  cpu: {
    usage: 45.2,
    temperature: 52.3,
  },
  memory: {
    used: 512,
    total: 1024,
    percentage: 50,
  },
  disk: {
    used: 2048,
    total: 8192,
    percentage: 25,
  },
  network: {
    wifi: {
      connected: true,
      rssi: -65,
      quality: 75,
    },
    dataRate: {
      up: 1024,
      down: 2048,
    },
  },
  uptime: 3600,
};

// Mock activity events
export const mockActivityEvents: ActivityEvent[] = [
  {
    id: '1',
    timestamp: new Date().getTime() - 60000,
    type: 'connection',
    level: 'info',
    message: 'Connected to YardRover Alpha',
    details: { device: 'YardRover Alpha', url: 'http://yardrover-001.local' },
  },
  {
    id: '2',
    timestamp: new Date().getTime() - 120000,
    type: 'mission',
    level: 'success',
    message: 'Mission completed successfully',
    details: { missionId: 'lawn-mow-001', duration: 1800 },
  },
  {
    id: '3',
    timestamp: new Date().getTime() - 180000,
    type: 'system',
    level: 'warning',
    message: 'Battery low warning',
    details: { batteryLevel: 15, voltage: 11.2 },
  },
  {
    id: '4',
    timestamp: new Date().getTime() - 240000,
    type: 'error',
    level: 'error',
    message: 'GPS signal lost',
    details: { lastKnownPosition: { lat: 45.5, lon: -73.5 } },
  },
];

// Mock telemetry data
export const mockTelemetryData = {
  battery: {
    voltage: 12.6,
    current: 2.5,
    percentage: 85,
    temperature: 25,
  },
  position: {
    lat: 45.5,
    lon: -73.5,
    alt: 100,
    relative_alt: 10,
  },
  velocity: {
    x: 0.5,
    y: 0.2,
    z: 0,
    ground: 0.54,
  },
  attitude: {
    roll: 0.1,
    pitch: -0.05,
    yaw: 1.57,
  },
  gps: {
    satellites_visible: 12,
    hdop: 1.2,
    vdop: 1.5,
    fix_type: 3,
  },
};

// Mock machine status
export const mockMachineStatus = {
  armed: false,
  flightMode: 'MANUAL',
  systemStatus: 'STANDBY',
  batteryLevel: 85,
  gpsStatus: 'FIX_3D',
  homePosition: {
    lat: 45.5,
    lon: -73.5,
    alt: 100,
  },
};
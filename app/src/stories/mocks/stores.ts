import { createPinia, setActivePinia } from 'pinia';

// Simple mock store data that doesn't depend on complex store setup
export const mockConnectionStates = {
  disconnected: {
    isConnected: false,
    isConnecting: false,
    connectionStatus: 'disconnected',
    connectionUrl: '',
    currentDevice: null,
  },
  connecting: {
    isConnected: false,
    isConnecting: true,
    connectionStatus: 'connecting',
    connectionUrl: 'http://yardrover-001.local',
    currentDevice: null,
  },
  connectedExcellent: {
    isConnected: true,
    isConnecting: false,
    connectionStatus: 'connected',
    connectionQuality: 'excellent',
    connectionUrl: 'http://yardrover-001.local',
    signalStrength: -45,
    latency: 12,
    currentDevice: {
      name: 'YardRover Alpha',
      ip: '192.168.1.100',
      port: 8080,
      services: { http: 8080, websocket: 8081 },
    },
  },
  connectedPoor: {
    isConnected: true,
    isConnecting: false,
    connectionStatus: 'connected',
    connectionQuality: 'poor',
    connectionUrl: 'http://192.168.1.103:8080',
    signalStrength: -85,
    latency: 120,
    currentDevice: {
      name: 'Remote Device',
      ip: '192.168.1.103',
      port: 8080,
      services: { http: 8080, websocket: 8081 },
    },
  },
};

export const mockTelemetryStates = {
  default: {
    battery: { level: 85, voltage: 12.6, current: 2.5, temperature: 25 },
    gps: { fix: 3, satellites: 12, hdop: 1.2 },
    flightMode: 'AUTO',
    armed: false,
    velocity: { ground: 0.5, x: 0.3, y: 0.4, z: 0 },
    attitude: { yaw: 1.57 },
    position: { lat: 45.5, lon: -73.5, relative_alt: 10.5 },
  },
  lowBattery: {
    battery: { level: 15, voltage: 11.2, current: 1.8, temperature: 30 },
    gps: { fix: 3, satellites: 8, hdop: 1.8 },
    flightMode: 'RTL',
    armed: true,
    velocity: { ground: 2.1, x: 1.5, y: 1.4, z: 0.2 },
    attitude: { yaw: 3.14 },
    position: { lat: 45.502, lon: -73.498, relative_alt: 5.2 },
  },
  armed: {
    battery: { level: 78, voltage: 12.4, current: 3.2, temperature: 28 },
    gps: { fix: 3, satellites: 15, hdop: 0.9 },
    flightMode: 'GUIDED',
    armed: true,
    velocity: { ground: 1.2, x: 0.8, y: 0.9, z: 0 },
    attitude: { yaw: 0.78 },
    position: { lat: 45.501, lon: -73.501, relative_alt: 8.3 },
  },
};

export const mockHealthStates = {
  excellent: {
    cpu: { usage: 25, temperature: 45 },
    memory: { used: 300, total: 1024, percentage: 29 },
    network: { wifi: { rssi: -45, quality: 90 } },
    uptime: 7200,
    overallHealth: 'excellent',
    memoryUsagePercentage: 29,
    temperatureStatus: 'normal',
    uptimeFormatted: '2h 0m',
    components: [
      { name: 'WiFi', status: 'healthy' },
      { name: 'MAVLink', status: 'healthy' },
      { name: 'RTCM', status: 'healthy' },
      { name: 'Storage', status: 'healthy' },
      { name: 'Sensors', status: 'healthy' },
    ],
  },
  critical: {
    cpu: { usage: 95, temperature: 82 },
    memory: { used: 950, total: 1024, percentage: 93 },
    network: { wifi: { rssi: -85, quality: 15 } },
    uptime: 86400,
    overallHealth: 'poor',
    memoryUsagePercentage: 93,
    temperatureStatus: 'hot',
    uptimeFormatted: '1d 0h',
    components: [
      { name: 'WiFi', status: 'error' },
      { name: 'MAVLink', status: 'warning' },
      { name: 'RTCM', status: 'error' },
      { name: 'Storage', status: 'error' },
      { name: 'Sensors', status: 'healthy' },
    ],
  },
};

export const mockActivityEvents = [
  {
    id: '1',
    timestamp: new Date(Date.now() - 60000),
    type: 'connection',
    message: 'Connected to YardRover Alpha',
    severity: 'low',
    acknowledged: true,
  },
  {
    id: '2',
    timestamp: new Date(Date.now() - 180000),
    type: 'warning',
    message: 'Battery low warning (15% remaining)',
    severity: 'medium',
    acknowledged: false,
  },
  {
    id: '3',
    timestamp: new Date(Date.now() - 240000),
    type: 'error',
    message: 'GPS signal temporarily lost',
    severity: 'high',
    acknowledged: false,
  },
];

// Helper function to create store decorators
export function createStoreDecorator(storeUpdates = {}) {
  return () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    
    // Apply updates to stores after they're created
    if (storeUpdates.connection) {
      // Dynamically import and setup connection store
      import('@/stores/connection').then(({ useConnectionStore }) => {
        const connectionStore = useConnectionStore();
        Object.assign(connectionStore, storeUpdates.connection);
      });
    }
    
    if (storeUpdates.telemetry) {
      import('@/stores/telemetry').then(({ useTelemetryStore }) => {
        const telemetryStore = useTelemetryStore();
        Object.assign(telemetryStore, storeUpdates.telemetry);
      });
    }
    
    if (storeUpdates.health) {
      import('@/stores/health').then(({ useHealthStore }) => {
        const healthStore = useHealthStore();
        Object.assign(healthStore, storeUpdates.health);
      });
    }
    
    if (storeUpdates.activity) {
      import('@/stores/activity').then(({ useActivityStore }) => {
        const activityStore = useActivityStore();
        if (storeUpdates.activity.events) {
          activityStore.events = storeUpdates.activity.events;
        }
      });
    }
    
    return { template: '<story />' };
  };
}
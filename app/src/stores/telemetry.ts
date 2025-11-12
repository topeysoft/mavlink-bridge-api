import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiClient } from '@/services/api/client';

// Mock MAVLink message interface for development
interface MAVLinkMessage {
  name: string;
  [key: string]: any;
}

export interface TelemetryData {
  // Battery
  battery: {
    level: number;
    voltage: number;
    current: number;
    remaining: number;
  };
  
  // GPS
  gps: {
    fix: number;
    satellites: number;
    hdop: number;
    vdop: number;
  };
  
  // Position
  position: {
    lat: number;
    lon: number;
    alt: number;
    relative_alt: number;
  };
  
  // Velocity
  velocity: {
    ground: number;
    air: number;
    climb: number;
  };
  
  // Attitude
  attitude: {
    roll: number;
    pitch: number;
    yaw: number;
  };
  
  // Status
  flightMode: string;
  armed: boolean;
  systemStatus: number;
}

export const useTelemetryStore = defineStore('telemetry', () => {
  // State
  const battery = ref({
    level: 85,
    voltage: 24.2,
    current: 2.1,
    remaining: 85
  });
  
  const gps = ref({
    fix: 3,
    satellites: 12,
    hdop: 1.2,
    vdop: 1.8
  });
  
  const position = ref({
    lat: 40.7128,
    lon: -74.0060,
    alt: 120,
    relative_alt: 15
  });
  
  const velocity = ref({
    ground: 1.5,
    air: 1.3,
    climb: 0.1
  });
  
  const attitude = ref({
    roll: 0.05,
    pitch: -0.02,
    yaw: 1.57
  });
  
  const flightMode = ref('AUTO');
  const armed = ref(false);
  const systemStatus = ref(4);
  
  const lastUpdate = ref<Date | null>(null);
  const isSubscribed = ref(false);
  
  // WebSocket subscription
  let unsubscribe: (() => void) | null = null;
  
  // Actions
  function startSubscription() {
    if (isSubscribed.value) return;
    
    const client = apiClient.getClient();
    if (!client) return;
    
    // Subscribe to MAVLink messages
    unsubscribe = client.on('mavlink_message', (message: MAVLinkMessage) => {
      handleMAVLinkMessage(message);
      lastUpdate.value = new Date();
    });
    
    isSubscribed.value = true;
  }
  
  function stopSubscription() {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    isSubscribed.value = false;
  }
  
  function handleMAVLinkMessage(message: MAVLinkMessage) {
    switch (message.name) {
      case 'HEARTBEAT':
        updateHeartbeat(message);
        break;
      
      case 'SYS_STATUS':
        updateSystemStatus(message);
        break;
      
      case 'BATTERY_STATUS':
        updateBatteryStatus(message);
        break;
      
      case 'GPS_RAW_INT':
        updateGPSStatus(message);
        break;
      
      case 'GLOBAL_POSITION_INT':
        updatePosition(message);
        break;
      
      case 'ATTITUDE':
        updateAttitude(message);
        break;
      
      case 'VFR_HUD':
        updateVFRHud(message);
        break;
    }
  }
  
  function updateHeartbeat(message: any) {
    const modeMapping: Record<number, string> = {
      0: 'STABILIZE',
      1: 'ACRO',
      2: 'ALT_HOLD',
      3: 'AUTO',
      4: 'GUIDED',
      5: 'LOITER',
      6: 'RTL',
      7: 'CIRCLE',
      9: 'LAND',
      15: 'AUTOTUNE',
      16: 'POSHOLD',
      19: 'MANUAL'
    };
    
    flightMode.value = modeMapping[message.custom_mode] || `MODE_${message.custom_mode}`;
    armed.value = (message.base_mode & 128) !== 0;
    systemStatus.value = message.system_status;
  }
  
  function updateSystemStatus(message: any) {
    battery.value.voltage = message.voltage_battery / 1000;
    battery.value.current = message.current_battery / 100;
    battery.value.remaining = message.battery_remaining;
    battery.value.level = message.battery_remaining;
  }
  
  function updateBatteryStatus(message: any) {
    if (message.voltages && message.voltages.length > 0) {
      battery.value.voltage = message.voltages[0] / 1000;
    }
    battery.value.current = message.current_consumed / 1000;
  }
  
  function updateGPSStatus(message: any) {
    gps.value.fix = message.fix_type;
    gps.value.satellites = message.satellites_visible;
    gps.value.hdop = message.eph / 100;
    gps.value.vdop = message.epv / 100;
  }
  
  function updatePosition(message: any) {
    position.value.lat = message.lat / 1e7;
    position.value.lon = message.lon / 1e7;
    position.value.alt = message.alt / 1000;
    position.value.relative_alt = message.relative_alt / 1000;
    
    velocity.value.ground = Math.sqrt(
      Math.pow(message.vx / 100, 2) + 
      Math.pow(message.vy / 100, 2)
    );
    velocity.value.climb = -message.vz / 100;
  }
  
  function updateAttitude(message: any) {
    attitude.value.roll = message.roll;
    attitude.value.pitch = message.pitch;
    attitude.value.yaw = message.yaw;
  }
  
  function updateVFRHud(message: any) {
    velocity.value.ground = message.groundspeed;
    velocity.value.air = message.airspeed;
    velocity.value.climb = message.climb;
  }
  
  // Getters
  const isConnected = computed(() => isSubscribed.value && lastUpdate.value !== null);
  
  const dataAge = computed(() => {
    if (!lastUpdate.value) return Infinity;
    return Date.now() - lastUpdate.value.getTime();
  });
  
  const isDataFresh = computed(() => dataAge.value < 5000); // 5 seconds
  
  return {
    // State
    battery,
    gps,
    position,
    velocity,
    attitude,
    flightMode,
    armed,
    systemStatus,
    lastUpdate,
    isSubscribed,
    
    // Getters
    isConnected,
    dataAge,
    isDataFresh,
    
    // Actions
    startSubscription,
    stopSubscription
  };
});
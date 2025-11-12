import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiClient } from '@/services/api/client';

// Mock health interfaces for development
interface SystemHealth {
  cpu?: { usage: number; temperature: number; frequency: number };
  memory?: { used: number; free: number; total: number };
  network?: { wifi?: { connected: boolean; rssi: number; quality: number } };
  components?: ComponentHealth[];
  uptime?: number;
}

interface ComponentHealth {
  name: string;
  status: 'healthy' | 'warning' | 'error';
  lastCheck: Date;
}

export interface HealthMetrics {
  cpu: {
    usage: number;
    temperature: number;
    frequency: number;
  };
  memory: {
    used: number;
    free: number;
    total: number;
    usage: number;
  };
  network: {
    wifi: {
      connected: boolean;
      rssi: number;
      quality: number;
    };
  };
  components: ComponentHealth[];
  uptime: number;
}

export const useHealthStore = defineStore('health', () => {
  // State
  const cpu = ref({
    usage: 25,
    temperature: 42,
    frequency: 240
  });
  
  const memory = ref({
    used: 180000,
    free: 140000,
    total: 320000,
    usage: 56
  });
  
  const network = ref({
    wifi: {
      connected: true,
      rssi: -45,
      quality: 85
    }
  });
  
  const components = ref<ComponentHealth[]>([
    { name: 'WiFi', status: 'healthy', lastCheck: new Date() },
    { name: 'MAVLink', status: 'healthy', lastCheck: new Date() },
    { name: 'RTCM', status: 'healthy', lastCheck: new Date() },
    { name: 'Storage', status: 'healthy', lastCheck: new Date() }
  ]);
  
  const uptime = ref(3600000); // 1 hour in ms
  const lastUpdate = ref<Date | null>(null);
  const isMonitoring = ref(false);
  
  // Health monitoring interval
  let monitoringInterval: NodeJS.Timeout | null = null;
  
  // Getters
  const overallHealth = computed(() => {
    const healthyComponents = components.value.filter(c => c.status === 'healthy').length;
    const totalComponents = components.value.length;
    const healthPercentage = (healthyComponents / totalComponents) * 100;
    
    if (healthPercentage === 100) return 'excellent';
    if (healthPercentage >= 75) return 'good';
    if (healthPercentage >= 50) return 'fair';
    return 'poor';
  });
  
  const memoryUsagePercentage = computed(() => {
    return Math.round((memory.value.used / memory.value.total) * 100);
  });
  
  const temperatureStatus = computed(() => {
    if (cpu.value.temperature < 60) return 'normal';
    if (cpu.value.temperature < 75) return 'warm';
    return 'hot';
  });
  
  const uptimeFormatted = computed(() => {
    const hours = Math.floor(uptime.value / 3600000);
    const minutes = Math.floor((uptime.value % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  });
  
  // Actions
  function startMonitoring() {
    if (isMonitoring.value) return;
    
    monitoringInterval = setInterval(async () => {
      await updateHealthMetrics();
    }, 5000); // Update every 5 seconds
    
    isMonitoring.value = true;
    updateHealthMetrics(); // Initial update
  }
  
  function stopMonitoring() {
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
      monitoringInterval = null;
    }
    isMonitoring.value = false;
  }
  
  async function updateHealthMetrics() {
    try {
      const client = apiClient.getClient();
      if (!client) return;
      
      const health = await client.getHealth();
      
      // Update CPU metrics
      if (health.cpu) {
        cpu.value.usage = health.cpu.usage || cpu.value.usage;
        cpu.value.temperature = health.cpu.temperature || cpu.value.temperature;
        cpu.value.frequency = health.cpu.frequency || cpu.value.frequency;
      }
      
      // Update memory metrics
      if (health.memory) {
        memory.value.used = health.memory.used || memory.value.used;
        memory.value.free = health.memory.free || memory.value.free;
        memory.value.total = health.memory.total || memory.value.total;
        memory.value.usage = Math.round((memory.value.used / memory.value.total) * 100);
      }
      
      // Update network metrics
      if (health.network?.wifi) {
        network.value.wifi.connected = health.network.wifi.connected ?? network.value.wifi.connected;
        network.value.wifi.rssi = health.network.wifi.rssi || network.value.wifi.rssi;
        network.value.wifi.quality = calculateSignalQuality(network.value.wifi.rssi);
      }
      
      // Update component health
      if (health.components) {
        components.value = health.components.map(comp => ({
          ...comp,
          lastCheck: new Date()
        }));
      }
      
      // Update uptime
      if (health.uptime) {
        uptime.value = health.uptime;
      }
      
      lastUpdate.value = new Date();
    } catch (error) {
      console.error('Failed to update health metrics:', error);
    }
  }
  
  function calculateSignalQuality(rssi: number): number {
    // Convert RSSI to percentage (rough approximation)
    if (rssi >= -30) return 100;
    if (rssi >= -50) return 90;
    if (rssi >= -60) return 75;
    if (rssi >= -70) return 50;
    if (rssi >= -80) return 25;
    return 10;
  }
  
  function updateComponent(name: string, status: 'healthy' | 'warning' | 'error') {
    const component = components.value.find(c => c.name === name);
    if (component) {
      component.status = status;
      component.lastCheck = new Date();
    }
  }
  
  return {
    // State
    cpu,
    memory,
    network,
    components,
    uptime,
    lastUpdate,
    isMonitoring,
    
    // Getters
    overallHealth,
    memoryUsagePercentage,
    temperatureStatus,
    uptimeFormatted,
    
    // Actions
    startMonitoring,
    stopMonitoring,
    updateHealthMetrics,
    updateComponent
  };
});
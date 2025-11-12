import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { MAVLinkBridgeDevice } from '@mavlinkbridge/api-client';
import { apiClient } from '@/services/api/client';
import { LocalStorage } from 'quasar';

export interface SavedDevice extends MAVLinkBridgeDevice {
  nickname?: string;
  lastSeen: number;
  favorite: boolean;
}

export const useDevicesStore = defineStore('devices', () => {
  // State
  const discoveredDevices = ref<MAVLinkBridgeDevice[]>([]);
  const savedDevices = ref<SavedDevice[]>([]);
  const isDiscovering = ref(false);
  const discoveryProgress = ref(0);

  // Load saved devices from storage
  const stored = LocalStorage.getItem('savedDevices');
  if (stored) {
    savedDevices.value = stored as SavedDevice[];
  }

  // Getters
  const favoriteDevices = computed(() =>
    savedDevices.value.filter(d => d.favorite)
  );

  const recentDevices = computed(() =>
    [...savedDevices.value].sort((a, b) =>
      b.lastSeen - a.lastSeen
    ).slice(0, 5)
  );

  // Actions
  async function discoverDevices (timeout = 5000) {
    try {
      isDiscovering.value = true;
      discoveryProgress.value = 0;
      discoveredDevices.value = [];

      const progressInterval = setInterval(() => {
        discoveryProgress.value = Math.min(
          discoveryProgress.value + (100 / (timeout / 100)),
          99
        );
      }, 100);

      const deviceUrls = await apiClient.discoverDevices(timeout);

      clearInterval(progressInterval);
      discoveryProgress.value = 100;

      // Convert URLs back to device objects for compatibility
      const devices: MAVLinkBridgeDevice[] = deviceUrls.map(url => {
        const urlObj = new URL(url);
        return {
          id: urlObj.hostname.replace(/\./g, '-'), // Convert IP to valid ID
          name: `YardRover at ${urlObj.hostname}`,
          hostname: urlObj.hostname,
          ip: urlObj.hostname,
          status: 'healthy' as const,
          isProvisioned: true,
          capabilities: {
            chipModel: 'ESP32',
            chipRevision: 1,
            flashSize: 4194304,
            sdkVersion: '4.4.0',
            coreCount: 2
          },
          network: {
            macAddress: '00:00:00:00:00:00',
            apMacAddress: '00:00:00:00:00:01',
            wifi: {
              status: 'connected'
            },
            ap: {
              enabled: false
            }
          },
          lastSeen: Date.now()
        };
      });

      discoveredDevices.value = devices;

      // Update last seen for any saved devices found
      devices.forEach(device => {
        const saved = savedDevices.value.find(s => s.ip === device.ip);
        if (saved) {
          saved.lastSeen = Date.now();
        }
      });

      persistSavedDevices();

      return devices;
    } finally {
      isDiscovering.value = false;
      setTimeout(() => {
        discoveryProgress.value = 0;
      }, 1000);
    }
  }

  function saveDevice (device: MAVLinkBridgeDevice, nickname?: string) {
    const existing = savedDevices.value.find(d => d.ip === device.ip);

    if (existing) {
      existing.nickname = nickname || existing.nickname;
      existing.lastSeen = Date.now();
    } else {
      savedDevices.value.push({
        ...device,
        nickname,
        lastSeen: Date.now(),
        favorite: false
      });
    }

    persistSavedDevices();
  }

  function removeDevice (ip: string) {
    const index = savedDevices.value.findIndex(d => d.ip === ip);
    if (index >= 0) {
      savedDevices.value.splice(index, 1);
      persistSavedDevices();
    }
  }

  function toggleFavorite (ip: string) {
    const device = savedDevices.value.find(d => d.ip === ip);
    if (device) {
      device.favorite = !device.favorite;
      persistSavedDevices();
    }
  }

  function updateNickname (ip: string, nickname: string) {
    const device = savedDevices.value.find(d => d.ip === ip);
    if (device) {
      device.nickname = nickname;
      persistSavedDevices();
    }
  }

  function persistSavedDevices () {
    LocalStorage.set('savedDevices', savedDevices.value);
  }

  function exportDevices () {
    const data = JSON.stringify(savedDevices.value, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'yardrover-devices.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importDevices (file: File) {
    try {
      const text = await file.text();
      const imported = JSON.parse(text) as SavedDevice[];

      // Merge with existing devices
      imported.forEach(device => {
        const existing = savedDevices.value.find(d => d.ip === device.ip);
        if (!existing) {
          savedDevices.value.push(device);
        }
      });

      persistSavedDevices();
    } catch (error) {
      throw new Error('Invalid device file format');
    }
  }

  return {
    // State
    discoveredDevices,
    savedDevices,
    isDiscovering,
    discoveryProgress,

    // Getters
    favoriteDevices,
    recentDevices,

    // Actions
    discoverDevices,
    saveDevice,
    removeDevice,
    toggleFavorite,
    updateNickname,
    exportDevices,
    importDevices
  };
});
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { LocalStorage } from 'quasar';
import type { AppConfig } from '@/services/api/types';

const STORAGE_KEY = 'yardrover-user-preferences';

export const useUserPreferencesStore = defineStore('userPreferences', () => {
  // State
  const autoConnect = ref(false);
  const defaultUrl = ref('http://192.168.4.1');
  const enableNotifications = ref(true);
  const enableSounds = ref(true);
  const language = ref('en-US');
  const units = ref<'metric' | 'imperial'>('metric');
  const mapProvider = ref<'osm' | 'satellite'>('osm');
  const dashboardLayout = ref<any[]>([]);
  
  // Actions
  function loadPreferences() {
    const stored = LocalStorage.getItem(STORAGE_KEY) as Partial<AppConfig> | null;
    
    if (stored) {
      autoConnect.value = stored.autoConnect ?? false;
      defaultUrl.value = stored.defaultUrl ?? 'http://192.168.4.1';
      enableNotifications.value = stored.enableNotifications ?? true;
      enableSounds.value = stored.enableSounds ?? true;
      language.value = stored.language ?? 'en-US';
      units.value = stored.units ?? 'metric';
      mapProvider.value = stored.mapProvider ?? 'osm';
      dashboardLayout.value = stored.dashboardLayout ?? [];
    }
  }
  
  function savePreferences() {
    const preferences = {
      autoConnect: autoConnect.value,
      defaultUrl: defaultUrl.value,
      enableNotifications: enableNotifications.value,
      enableSounds: enableSounds.value,
      language: language.value,
      units: units.value,
      mapProvider: mapProvider.value,
      dashboardLayout: dashboardLayout.value
    };
    
    LocalStorage.set(STORAGE_KEY, preferences);
  }
  
  function updatePreference(
    key: string, 
    value: any
  ) {
    switch (key) {
      case 'autoConnect':
        autoConnect.value = value;
        break;
      case 'defaultUrl':
        defaultUrl.value = value;
        break;
      case 'enableNotifications':
        enableNotifications.value = value;
        break;
      case 'enableSounds':
        enableSounds.value = value;
        break;
      case 'language':
        language.value = value;
        break;
      case 'units':
        units.value = value;
        break;
      case 'mapProvider':
        mapProvider.value = value;
        break;
      case 'dashboardLayout':
        dashboardLayout.value = value;
        break;
    }
    savePreferences();
  }
  
  function setDashboardLayout(layout: any[]) {
    dashboardLayout.value = layout;
    savePreferences();
  }
  
  // Initialize on store creation
  loadPreferences();
  
  return {
    // State
    autoConnect,
    defaultUrl,
    enableNotifications,
    enableSounds,
    language,
    units,
    mapProvider,
    dashboardLayout,
    
    // Actions
    loadPreferences,
    savePreferences,
    updatePreference,
    setDashboardLayout
  };
});
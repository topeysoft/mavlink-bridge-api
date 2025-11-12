import { createPinia, setActivePinia } from 'pinia';

export const withPinia = () => {
  return () => {
    setActivePinia(createPinia());
    return { template: '<story />' };
  };
};

export const withMockStores = (storeUpdates: Record<string, any>) => {
  return () => {
    setActivePinia(createPinia());
    
    // Apply store updates after pinia is set
    Object.entries(storeUpdates).forEach(([storeName, updates]) => {
      // Dynamically import and update stores
      if (storeName === 'connection') {
        import('@/stores/connection').then(({ useConnectionStore }) => {
          const store = useConnectionStore();
          store.$patch(updates);
        });
      }
      if (storeName === 'telemetry') {
        import('@/stores/telemetry').then(({ useTelemetryStore }) => {
          const store = useTelemetryStore();
          store.$patch(updates);
        });
      }
      if (storeName === 'health') {
        import('@/stores/health').then(({ useHealthStore }) => {
          const store = useHealthStore();
          store.$patch(updates);
        });
      }
      if (storeName === 'activity') {
        import('@/stores/activity').then(({ useActivityStore }) => {
          const store = useActivityStore();
          store.$patch(updates);
        });
      }
    });
    
    return { template: '<story />' };
  };
};
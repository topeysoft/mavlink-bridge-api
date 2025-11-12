import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { yardService } from '@/services';
import type { Yard, YardLocation, Zone, ApiState } from './types';

export const useYardStore = defineStore('yard', () => {
    // State
    const yards = ref<Yard[]>([]);
    const currentYard = ref<Yard | null>(null);
    const zones = ref<Zone[]>([]);
    const yardLocations = ref<YardLocation[]>([]);
    const apiState = ref<ApiState>({
        loading: 'idle',
        error: null,
        lastUpdated: null,
    });

    // Getters
    const availableYards = computed(() =>
        yards.value.filter(yard => yard.status === 'active')
    );

    const currentYardZones = computed(() => {
        if (!currentYard.value) return [];
        return zones.value.filter(zone => zone.yardId === currentYard.value!.id);
    });

    const activeZones = computed(() =>
        zones.value.filter(zone => zone.status === 'active')
    );

    const restrictedZones = computed(() =>
        zones.value.filter(zone => zone.status === 'restricted')
    );

    const maintenanceZones = computed(() =>
        zones.value.filter(zone => zone.status === 'maintenance')
    );

    const yardStats = computed(() => {
        if (!currentYard.value) return null;

        const yardZones = currentYardZones.value;
        return {
            totalArea: yardZones.reduce((sum, zone) => sum + zone.area, 0),
            totalZones: yardZones.length,
            activeZones: yardZones.filter(z => z.status === 'active').length,
            restrictedZones: yardZones.filter(z => z.status === 'restricted').length,
            maintenanceZones: yardZones.filter(z => z.status === 'maintenance').length,
        };
    });

    const isLoading = computed(() => apiState.value.loading === 'loading');
    const hasError = computed(() => apiState.value.error !== null);

    // Actions
    const setLoading = (loading: boolean) => {
        apiState.value.loading = loading ? 'loading' : 'idle';
    };

    const setError = (error: string | null) => {
        apiState.value.error = error;
        if (error) {
            apiState.value.loading = 'error';
        }
    };

    const clearError = () => {
        apiState.value.error = null;
    };

    const setCurrentYard = (yard: Yard | null) => {
        currentYard.value = yard;
    };

    const addYard = (yard: Yard) => {
        const existingIndex = yards.value.findIndex(y => y.id === yard.id);
        if (existingIndex >= 0) {
            yards.value[existingIndex] = yard;
        } else {
            yards.value.push(yard);
        }
        apiState.value.lastUpdated = new Date().toISOString();
    };

    const updateYard = (yardId: string, updates: Partial<Yard>) => {
        const yardIndex = yards.value.findIndex(y => y.id === yardId);
        if (yardIndex >= 0) {
            yards.value[yardIndex] = { ...yards.value[yardIndex], ...updates };

            // Update current yard if it's the one being updated
            if (currentYard.value?.id === yardId) {
                currentYard.value = yards.value[yardIndex];
            }

            apiState.value.lastUpdated = new Date().toISOString();
        }
    };

    const removeYard = (yardId: string) => {
        const yardIndex = yards.value.findIndex(y => y.id === yardId);
        if (yardIndex >= 0) {
            yards.value.splice(yardIndex, 1);

            // Clear current yard if it was the one being removed
            if (currentYard.value?.id === yardId) {
                currentYard.value = null;
            }

            apiState.value.lastUpdated = new Date().toISOString();
        }
    };

    const addZone = (zone: Zone) => {
        const existingIndex = zones.value.findIndex(z => z.id === zone.id);
        if (existingIndex >= 0) {
            zones.value[existingIndex] = zone;
        } else {
            zones.value.push(zone);
        }
        apiState.value.lastUpdated = new Date().toISOString();
    };

    const updateZone = (zoneId: string, updates: Partial<Zone>) => {
        const zoneIndex = zones.value.findIndex(z => z.id === zoneId);
        if (zoneIndex >= 0) {
            zones.value[zoneIndex] = { ...zones.value[zoneIndex], ...updates };
            apiState.value.lastUpdated = new Date().toISOString();
        }
    };

    const removeZone = (zoneId: string) => {
        const zoneIndex = zones.value.findIndex(z => z.id === zoneId);
        if (zoneIndex >= 0) {
            zones.value.splice(zoneIndex, 1);
            apiState.value.lastUpdated = new Date().toISOString();
        }
    };

    const addLocation = (location: YardLocation) => {
        const existingIndex = yardLocations.value.findIndex(l => l.id === location.id);
        if (existingIndex >= 0) {
            yardLocations.value[existingIndex] = location;
        } else {
            yardLocations.value.push(location);
        }
        apiState.value.lastUpdated = new Date().toISOString();
    };

    const updateLocation = (locationId: string, updates: Partial<YardLocation>) => {
        const locationIndex = yardLocations.value.findIndex(l => l.id === locationId);
        if (locationIndex >= 0) {
            yardLocations.value[locationIndex] = { ...yardLocations.value[locationIndex], ...updates };
            apiState.value.lastUpdated = new Date().toISOString();
        }
    };

    const removeLocation = (locationId: string) => {
        const locationIndex = yardLocations.value.findIndex(l => l.id === locationId);
        if (locationIndex >= 0) {
            yardLocations.value.splice(locationIndex, 1);
            apiState.value.lastUpdated = new Date().toISOString();
        }
    };

    // API Actions
    const fetchYards = async () => {
        try {
            setLoading(true);
            clearError();

            const fetchedYards = await yardService.getYards();
            yards.value = fetchedYards;

            // Set first yard as current if none selected
            if (!currentYard.value && fetchedYards.length > 0) {
                setCurrentYard(fetchedYards[0]);
            }

            apiState.value.loading = 'success';
            return fetchedYards;
        } catch (error: any) {
            setError(error.message || 'Failed to fetch yards');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const fetchYardById = async (yardId: string) => {
        try {
            setLoading(true);
            clearError();

            const yard = await yardService.getYard(yardId);
            addYard(yard);

            apiState.value.loading = 'success';
            return yard;
        } catch (error: any) {
            setError(error.message || 'Failed to fetch yard');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const createYard = async (yardData: Omit<Yard, 'id' | 'createdAt' | 'updatedAt'>) => {
        try {
            setLoading(true);
            clearError();

            const newYard = await yardService.createYard(yardData);
            addYard(newYard);

            apiState.value.loading = 'success';
            return newYard;
        } catch (error: any) {
            setError(error.message || 'Failed to create yard');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const updateYardById = async (yardId: string, updates: Partial<Yard>) => {
        try {
            setLoading(true);
            clearError();

            const updatedYard = await yardService.updateYard(yardId, updates);
            addYard(updatedYard);

            apiState.value.loading = 'success';
            return updatedYard;
        } catch (error: any) {
            setError(error.message || 'Failed to update yard');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const deleteYard = async (yardId: string) => {
        try {
            setLoading(true);
            clearError();

            await yardService.deleteYard(yardId);
            removeYard(yardId);

            apiState.value.loading = 'success';
        } catch (error: any) {
            setError(error.message || 'Failed to delete yard');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const fetchZones = async (yardId: string) => {
        try {
            setLoading(true);
            clearError();

            const fetchedZones = await yardService.getZones(yardId);

            // Replace zones for this yard
            zones.value = zones.value.filter(z => z.yardId !== yardId);
            fetchedZones.forEach(zone => addZone(zone));

            apiState.value.loading = 'success';
            return fetchedZones;
        } catch (error: any) {
            setError(error.message || 'Failed to fetch zones');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const createZone = async (yardId: string, zoneData: Omit<Zone, 'id' | 'yardId' | 'createdAt' | 'updatedAt'>) => {
        try {
            setLoading(true);
            clearError();

            const newZone = await yardService.createZone(yardId, zoneData);
            addZone(newZone);

            apiState.value.loading = 'success';
            return newZone;
        } catch (error: any) {
            setError(error.message || 'Failed to create zone');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const updateZoneById = async (zoneId: string, updates: Partial<Zone>) => {
        try {
            setLoading(true);
            clearError();

            const updatedZone = await yardService.updateZone(zoneId, updates);
            addZone(updatedZone);

            apiState.value.loading = 'success';
            return updatedZone;
        } catch (error: any) {
            setError(error.message || 'Failed to update zone');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const deleteZone = async (zoneId: string) => {
        try {
            setLoading(true);
            clearError();

            await yardService.deleteZone(zoneId);
            removeZone(zoneId);

            apiState.value.loading = 'success';
        } catch (error: any) {
            setError(error.message || 'Failed to delete zone');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const fetchLocations = async (yardId: string) => {
        try {
            setLoading(true);
            clearError();

            const fetchedLocations = await yardService.getLocations(yardId);

            // Replace locations for this yard
            yardLocations.value = yardLocations.value.filter(l => l.yardId !== yardId);
            fetchedLocations.forEach(location => addLocation(location));

            apiState.value.loading = 'success';
            return fetchedLocations;
        } catch (error: any) {
            setError(error.message || 'Failed to fetch locations');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const createLocation = async (yardId: string, locationData: Omit<YardLocation, 'id' | 'yardId' | 'createdAt' | 'updatedAt'>) => {
        try {
            setLoading(true);
            clearError();

            const newLocation = await yardService.createLocation(yardId, locationData);
            addLocation(newLocation);

            apiState.value.loading = 'success';
            return newLocation;
        } catch (error: any) {
            setError(error.message || 'Failed to create location');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const updateLocationById = async (locationId: string, updates: Partial<YardLocation>) => {
        try {
            setLoading(true);
            clearError();

            const updatedLocation = await yardService.updateLocation(locationId, updates);
            addLocation(updatedLocation);

            apiState.value.loading = 'success';
            return updatedLocation;
        } catch (error: any) {
            setError(error.message || 'Failed to update location');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const deleteLocation = async (locationId: string) => {
        try {
            setLoading(true);
            clearError();

            await yardService.deleteLocation(locationId);
            removeLocation(locationId);

            apiState.value.loading = 'success';
        } catch (error: any) {
            setError(error.message || 'Failed to delete location');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    // Utility functions
    const getZoneById = (zoneId: string): Zone | undefined => {
        return zones.value.find(zone => zone.id === zoneId);
    };

    const getZonesByStatus = (status: Zone['status']): Zone[] => {
        return zones.value.filter(zone => zone.status === status);
    };

    const getZonesByType = (type: Zone['type']): Zone[] => {
        return zones.value.filter(zone => zone.type === type);
    };

    const getLocationById = (locationId: string): YardLocation | undefined => {
        return yardLocations.value.find(location => location.id === locationId);
    };

    const getLocationsByZone = (zoneId: string): YardLocation[] => {
        return yardLocations.value.filter(location => location.zoneId === zoneId);
    };

    const isLocationInZone = (locationId: string, zoneId: string): boolean => {
        const location = getLocationById(locationId);
        return location?.zoneId === zoneId;
    };

    const getAccessibleZones = (userRole: string): Zone[] => {
        // Filter zones based on user permissions
        // This would depend on your access control system
        return zones.value.filter(zone => {
            if (userRole === 'admin') return true;
            if (userRole === 'operator') return zone.status !== 'restricted';
            return zone.status === 'active';
        });
    };

    // WebSocket handlers for real-time updates
    const handleWebSocketUpdate = (eventType: string, data: any) => {
        switch (eventType) {
            case 'yard.updated':
                if (data.yard) {
                    addYard(data.yard);
                }
                break;

            case 'zone.updated':
                if (data.zone) {
                    addZone(data.zone);
                }
                break;

            case 'zone.status':
                if (data.zoneId && data.status) {
                    updateZone(data.zoneId, { status: data.status });
                }
                break;

            case 'location.updated':
                if (data.location) {
                    addLocation(data.location);
                }
                break;
        }
    };

    // Reset store state
    const $reset = () => {
        yards.value = [];
        currentYard.value = null;
        zones.value = [];
        yardLocations.value = [];
        apiState.value = {
            loading: 'idle',
            error: null,
            lastUpdated: null,
        };
    };

    return {
        // State
        yards: computed(() => yards.value),
        currentYard: computed(() => currentYard.value),
        zones: computed(() => zones.value),
        yardLocations: computed(() => yardLocations.value),
        apiState: computed(() => apiState.value),

        // Getters
        availableYards,
        currentYardZones,
        activeZones,
        restrictedZones,
        maintenanceZones,
        yardStats,
        isLoading,
        hasError,

        // Actions
        setCurrentYard,
        fetchYards,
        fetchYardById,
        createYard,
        updateYardById,
        deleteYard,
        fetchZones,
        createZone,
        updateZoneById,
        deleteZone,
        fetchLocations,
        createLocation,
        updateLocationById,
        deleteLocation,
        getZoneById,
        getZonesByStatus,
        getZonesByType,
        getLocationById,
        getLocationsByZone,
        isLocationInZone,
        getAccessibleZones,
        handleWebSocketUpdate,
        clearError,
        $reset,
    };
});

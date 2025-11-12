/**
 * Pinia plugin for persisting store state to localStorage
 * Automatically saves and restores specific store data
 */
export const persistencePlugin = ({ store }: { store: any }) => {
    // Configuration for which stores to persist and what data
    const persistentStores = {
        auth: ['user', 'token', 'refreshToken', 'isAuthenticated'],
        settings: ['settings'],
        ui: ['state'],
    };

    const storeId = store.$id;

    // Skip non-persistent stores
    if (!persistentStores[storeId as keyof typeof persistentStores]) {
        return;
    }

    const storageKey = `yardrover-${storeId}`;
    const fieldsToSave = persistentStores[storeId as keyof typeof persistentStores];

    // Load persisted state on store creation
    try {
        if (typeof localStorage !== 'undefined') {
            const savedState = localStorage.getItem(storageKey);
            if (savedState) {
                const parsedState = JSON.parse(savedState);

                // Only restore specified fields
                const stateToRestore: any = {};
                fieldsToSave.forEach(field => {
                    if (field in parsedState) {
                        stateToRestore[field] = parsedState[field];
                    }
                });

                if (Object.keys(stateToRestore).length > 0) {
                    store.$patch(stateToRestore);
                }
            }
        }
    } catch (error) {
        console.warn(`Failed to load persisted state for ${storeId}:`, error);
    }

    // Save state changes to localStorage
    store.$subscribe((mutation: any, state: any) => {
        try {
            if (typeof localStorage !== 'undefined') {
                // Only save specified fields
                const stateToSave: any = {};
                fieldsToSave.forEach(field => {
                    if (field in state) {
                        stateToSave[field] = state[field];
                    }
                });

                localStorage.setItem(storageKey, JSON.stringify(stateToSave));
            }
        } catch (error) {
            console.warn(`Failed to persist state for ${storeId}:`, error);
        }
    });

    // Add methods to manually control persistence
    store.clearPersistedData = () => {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(storageKey);
        }
    };

    store.exportPersistedData = () => {
        if (typeof localStorage !== 'undefined') {
            const data = localStorage.getItem(storageKey);
            return data ? JSON.parse(data) : null;
        }
        return null;
    };
};

/**
 * Pinia plugin for development tools and debugging
 * Adds debugging capabilities and development helpers
 */
export const devtoolsPlugin = ({ store }: { store: any }) => {
    const storeId = store.$id;

    // Add development metadata
    store._devMode = true;
    store._createdAt = new Date().toISOString();
    store._actionHistory = [];
    store._mutationHistory = [];

    // Track all store actions in development
    const originalActions: Record<string, any> = {};

    // Find all action methods (functions that aren't computed properties or state)
    Object.getOwnPropertyNames(store).forEach(key => {
        const value = store[key];
        if (typeof value === 'function' && !key.startsWith('$') && !key.startsWith('_')) {
            originalActions[key] = value;

            // Wrap action with debugging
            store[key] = (...args: any[]) => {
                const actionStart = performance.now();
                const actionInfo = {
                    action: key,
                    args: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg),
                    timestamp: new Date().toISOString(),
                    storeId,
                };

                try {
                    const result = originalActions[key].apply(store, args);

                    const actionEnd = performance.now();
                    const executionTime = actionEnd - actionStart;

                    store._actionHistory.push({
                        ...actionInfo,
                        executionTime,
                        success: true,
                    });

                    // Keep only last 100 actions
                    if (store._actionHistory.length > 100) {
                        store._actionHistory = store._actionHistory.slice(-100);
                    }

                    console.log(`[${storeId}] Action: ${key}`, {
                        args,
                        executionTime: `${executionTime.toFixed(2)}ms`,
                        result: typeof result === 'object' ? '[Object]' : result,
                    });

                    return result;
                } catch (error) {
                    store._actionHistory.push({
                        ...actionInfo,
                        error: error instanceof Error ? error.message : String(error),
                        success: false,
                    });

                    console.error(`[${storeId}] Action failed: ${key}`, {
                        args,
                        error,
                    });

                    throw error;
                }
            };
        }
    });

    // Track state mutations
    store.$subscribe((mutation: any, state: any) => {
        const mutationInfo = {
            type: mutation.type,
            storeId: mutation.storeId,
            timestamp: new Date().toISOString(),
            payload: typeof mutation.payload === 'object' ?
                JSON.stringify(mutation.payload) : mutation.payload,
        };

        store._mutationHistory.push(mutationInfo);

        // Keep only last 100 mutations
        if (store._mutationHistory.length > 100) {
            store._mutationHistory = store._mutationHistory.slice(-100);
        }

        console.log(`[${storeId}] State mutation:`, mutationInfo);
    });

    // Add debugging methods
    store.$debug = {
        // Get store statistics
        getStats: () => ({
            storeId,
            createdAt: store._createdAt,
            actionsCount: store._actionHistory.length,
            mutationsCount: store._mutationHistory.length,
            lastAction: store._actionHistory[store._actionHistory.length - 1],
            lastMutation: store._mutationHistory[store._mutationHistory.length - 1],
        }),

        // Get action history
        getActionHistory: (limit = 50) =>
            store._actionHistory.slice(-limit),

        // Get mutation history
        getMutationHistory: (limit = 50) =>
            store._mutationHistory.slice(-limit),

        // Get store state snapshot
        getStateSnapshot: () => JSON.parse(JSON.stringify(store.$state)),

        // Log current state
        logState: () => {
            console.log(`[${storeId}] Current state:`, store.$state);
        },

        // Reset debugging data
        resetHistory: () => {
            store._actionHistory = [];
            store._mutationHistory = [];
        },

        // Export debugging data
        exportDebugData: () => ({
            storeId,
            createdAt: store._createdAt,
            actions: store._actionHistory,
            mutations: store._mutationHistory,
            currentState: store.$state,
            exportedAt: new Date().toISOString(),
        }),
    };

    // Add global debugging access
    if (typeof window !== 'undefined') {
        if (!window.__YARDROVER_STORES__) {
            window.__YARDROVER_STORES__ = {};
        }
        window.__YARDROVER_STORES__[storeId] = store;
    }

    console.log(`[DevTools] Initialized debugging for store: ${storeId}`);
};

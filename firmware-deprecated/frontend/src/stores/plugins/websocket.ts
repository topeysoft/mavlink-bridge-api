/**
 * Pinia plugin for WebSocket integration
 * Connects stores to real-time WebSocket events
 */
export const websocketPlugin = ({ store }: { store: any }) => {
    const storeId = store.$id;

    // Stores that support WebSocket updates
    const websocketEnabledStores = [
        'machine',
        'tasks',
        'yard',
        'notifications',
    ];

    // Skip stores that don't need WebSocket integration
    if (!websocketEnabledStores.includes(storeId)) {
        return;
    }

    // Add WebSocket event handler if the store supports it
    if (store.handleWebSocketUpdate && typeof store.handleWebSocketUpdate === 'function') {
        // Store reference to the handler for external access
        store._websocketHandler = (eventType: string, data: any) => {
            try {
                store.handleWebSocketUpdate(eventType, data);
            } catch (error) {
                console.warn(`WebSocket event handler error in ${storeId}:`, error);
            }
        };

        // Add convenience methods for WebSocket interaction
        store.onWebSocketEvent = (eventType: string, callback: (data: any) => void) => {
            // This would be implemented by the WebSocket store
            const unsubscribe = () => {
                // Cleanup logic would go here
            };

            return unsubscribe;
        };

        // Add method to send WebSocket messages from store
        store.sendWebSocketMessage = (type: string, payload: any) => {
            // This would delegate to the WebSocket store
            // In practice, you'd get the WebSocket store and call its send method
            try {
                // Example: websocketStore.send({ type, payload });
                console.log(`Sending WebSocket message from ${storeId}:`, { type, payload });
            } catch (error) {
                console.warn(`Failed to send WebSocket message from ${storeId}:`, error);
            }
        };
    }

    // Add debugging information in development
    if (import.meta.env.DEV) {
        store._websocketEnabled = true;
        store._websocketEvents = [];

        // Track WebSocket events for debugging
        if (store._websocketHandler) {
            const originalHandler = store._websocketHandler;
            store._websocketHandler = (eventType: string, data: any) => {
                store._websocketEvents.push({
                    eventType,
                    timestamp: new Date().toISOString(),
                    data: typeof data === 'object' ? JSON.stringify(data) : data,
                });

                // Keep only last 50 events
                if (store._websocketEvents.length > 50) {
                    store._websocketEvents = store._websocketEvents.slice(-50);
                }

                originalHandler(eventType, data);
            };
        }
    }
};

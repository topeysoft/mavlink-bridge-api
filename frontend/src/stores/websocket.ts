import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { WebSocketState, WebSocketEvent } from './types';

export const useWebSocketStore = defineStore('websocket', () => {
    // State
    const state = ref<WebSocketState>({
        connected: false,
        connecting: false,
        lastConnected: undefined,
        reconnectAttempts: 0,
        maxReconnectAttempts: 5,
        reconnectInterval: 5000, // 5 seconds
        events: [],
    });

    const socket = ref<WebSocket | null>(null);
    const reconnectTimeout = ref<number | null>(null);
    const heartbeatInterval = ref<number | null>(null);
    const messageQueue = ref<any[]>([]);

    // Getters
    const isConnected = computed(() => state.value.connected);
    const isConnecting = computed(() => state.value.connecting);
    const connectionStatus = computed(() => {
        if (state.value.connected) return 'connected';
        if (state.value.connecting) return 'connecting';
        return 'disconnected';
    });

    const canReconnect = computed(() =>
        state.value.reconnectAttempts < state.value.maxReconnectAttempts
    );

    const recentEvents = computed(() =>
        state.value.events
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 50)
    );

    const eventsByType = computed(() => {
        const grouped: Record<string, WebSocketEvent[]> = {};
        state.value.events.forEach(event => {
            if (!grouped[event.type]) {
                grouped[event.type] = [];
            }
            grouped[event.type].push(event);
        });
        return grouped;
    });

    // Event listeners
    const eventListeners = ref<Map<string, ((data: any) => void)[]>>(new Map());

    // Actions
    const setConnected = (connected: boolean) => {
        state.value.connected = connected;
        if (connected) {
            state.value.lastConnected = new Date().toISOString();
            state.value.reconnectAttempts = 0;
            state.value.connecting = false;

            // Send queued messages
            flushMessageQueue();
        }
    };

    const setConnecting = (connecting: boolean) => {
        state.value.connecting = connecting;
    };

    const addEvent = (event: Omit<WebSocketEvent, 'id' | 'timestamp'>) => {
        const newEvent: WebSocketEvent = {
            id: generateEventId(),
            timestamp: new Date().toISOString(),
            ...event,
        };

        state.value.events.unshift(newEvent);

        // Keep only last 1000 events
        if (state.value.events.length > 1000) {
            state.value.events = state.value.events.slice(0, 1000);
        }

        // Notify listeners
        notifyListeners(event.type, event.data);
    };

    const connect = (url: string, protocols?: string[]) => {
        if (state.value.connected || state.value.connecting) {
            return;
        }

        setConnecting(true);

        try {
            socket.value = new WebSocket(url, protocols);

            socket.value.onopen = handleOpen;
            socket.value.onmessage = handleMessage;
            socket.value.onclose = handleClose;
            socket.value.onerror = handleError;

        } catch (error) {
            handleError(error as Event);
        }
    };

    const disconnect = () => {
        if (socket.value) {
            // Clear heartbeat
            if (heartbeatInterval.value) {
                clearInterval(heartbeatInterval.value);
                heartbeatInterval.value = null;
            }

            // Clear reconnect timeout
            if (reconnectTimeout.value) {
                clearTimeout(reconnectTimeout.value);
                reconnectTimeout.value = null;
            }

            socket.value.close(1000, 'Client disconnect');
            socket.value = null;
        }

        setConnected(false);
        setConnecting(false);
        state.value.reconnectAttempts = 0;
    };

    const send = (data: any) => {
        if (state.value.connected && socket.value) {
            try {
                const message = typeof data === 'string' ? data : JSON.stringify(data);
                socket.value.send(message);

                addEvent({
                    type: 'message.sent',
                    data: { message: data },
                });
            } catch (error) {
                addEvent({
                    type: 'error.send',
                    data: { error: 'Failed to send message', data },
                });
            }
        } else {
            // Queue message for later
            messageQueue.value.push(data);
        }
    };

    const flushMessageQueue = () => {
        while (messageQueue.value.length > 0 && state.value.connected) {
            const message = messageQueue.value.shift();
            send(message);
        }
    };

    const clearMessageQueue = () => {
        messageQueue.value = [];
    };

    // Event handlers
    const handleOpen = () => {
        setConnected(true);

        addEvent({
            type: 'connection.opened',
            data: { timestamp: new Date().toISOString() },
        });

        // Start heartbeat
        startHeartbeat();
    };

    const handleMessage = (event: MessageEvent) => {
        try {
            const data = JSON.parse(event.data);

            // Handle heartbeat/pong responses
            if (data.type === 'pong') {
                return;
            }

            addEvent({
                type: data.type || 'message.received',
                data: data,
            });

        } catch (error) {
            addEvent({
                type: 'error.parse',
                data: { error: 'Failed to parse message', raw: event.data },
            });
        }
    };

    const handleClose = (event: CloseEvent) => {
        setConnected(false);
        setConnecting(false);

        if (heartbeatInterval.value) {
            clearInterval(heartbeatInterval.value);
            heartbeatInterval.value = null;
        }

        addEvent({
            type: 'connection.closed',
            data: {
                code: event.code,
                reason: event.reason,
                wasClean: event.wasClean,
            },
        });

        // Auto-reconnect if not a clean close
        if (!event.wasClean && canReconnect.value) {
            scheduleReconnect();
        }
    };

    const handleError = (error: Event) => {
        addEvent({
            type: 'connection.error',
            data: { error: 'WebSocket error occurred' },
        });

        setConnecting(false);
    };

    // Reconnection logic
    const scheduleReconnect = () => {
        if (!canReconnect.value) {
            return;
        }

        state.value.reconnectAttempts++;

        const delay = Math.min(
            state.value.reconnectInterval * Math.pow(2, state.value.reconnectAttempts - 1),
            30000 // Max 30 seconds
        );

        addEvent({
            type: 'reconnect.scheduled',
            data: {
                attempt: state.value.reconnectAttempts,
                delay,
                maxAttempts: state.value.maxReconnectAttempts,
            },
        });

        reconnectTimeout.value = window.setTimeout(() => {
            if (!state.value.connected && canReconnect.value) {
                // This would need the original URL - in a real app, store it
                // connect(originalUrl);
            }
        }, delay);
    };

    const resetReconnectAttempts = () => {
        state.value.reconnectAttempts = 0;
        if (reconnectTimeout.value) {
            clearTimeout(reconnectTimeout.value);
            reconnectTimeout.value = null;
        }
    };

    // Heartbeat to keep connection alive
    const startHeartbeat = () => {
        if (heartbeatInterval.value) {
            clearInterval(heartbeatInterval.value);
        }

        heartbeatInterval.value = window.setInterval(() => {
            if (state.value.connected) {
                send({ type: 'ping', timestamp: new Date().toISOString() });
            }
        }, 30000); // 30 seconds
    };

    // Event listener management
    const addEventListener = (eventType: string, callback: (data: any) => void) => {
        if (!eventListeners.value.has(eventType)) {
            eventListeners.value.set(eventType, []);
        }

        const listeners = eventListeners.value.get(eventType)!;
        listeners.push(callback);

        // Return unsubscribe function
        return () => {
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        };
    };

    const removeEventListener = (eventType: string, callback: (data: any) => void) => {
        const listeners = eventListeners.value.get(eventType);
        if (listeners) {
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    };

    const removeAllEventListeners = (eventType?: string) => {
        if (eventType) {
            eventListeners.value.delete(eventType);
        } else {
            eventListeners.value.clear();
        }
    };

    const notifyListeners = (eventType: string, data: any) => {
        const listeners = eventListeners.value.get(eventType);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    addEvent({
                        type: 'error.listener',
                        data: { error: 'Event listener error', eventType },
                    });
                }
            });
        }
    };

    // Utility methods
    const generateEventId = (): string => {
        return `ws_event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    };

    const getEventHistory = (eventType?: string, limit = 100): WebSocketEvent[] => {
        let events = state.value.events;

        if (eventType) {
            events = events.filter(event => event.type === eventType);
        }

        return events
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, limit);
    };

    const clearEventHistory = () => {
        state.value.events = [];
    };

    const getConnectionStats = () => {
        const now = new Date();
        const connectedAt = state.value.lastConnected ? new Date(state.value.lastConnected) : null;
        const connectionDuration = connectedAt ? now.getTime() - connectedAt.getTime() : 0;

        return {
            connected: state.value.connected,
            connecting: state.value.connecting,
            lastConnected: state.value.lastConnected,
            connectionDuration,
            reconnectAttempts: state.value.reconnectAttempts,
            maxReconnectAttempts: state.value.maxReconnectAttempts,
            totalEvents: state.value.events.length,
            queuedMessages: messageQueue.value.length,
        };
    };

    // Configuration
    const setReconnectConfig = (maxAttempts: number, interval: number) => {
        state.value.maxReconnectAttempts = maxAttempts;
        state.value.reconnectInterval = interval;
    };

    // Subscribe to specific machine/yard events
    const subscribeToMachine = (machineId: string) => {
        send({
            type: 'subscribe',
            payload: {
                channel: 'machine',
                machineId,
            },
        });
    };

    const unsubscribeFromMachine = (machineId: string) => {
        send({
            type: 'unsubscribe',
            payload: {
                channel: 'machine',
                machineId,
            },
        });
    };

    const subscribeToYard = (yardId: string) => {
        send({
            type: 'subscribe',
            payload: {
                channel: 'yard',
                yardId,
            },
        });
    };

    const unsubscribeFromYard = (yardId: string) => {
        send({
            type: 'unsubscribe',
            payload: {
                channel: 'yard',
                yardId,
            },
        });
    };

    // Reset store state
    const $reset = () => {
        disconnect();

        state.value = {
            connected: false,
            connecting: false,
            lastConnected: undefined,
            reconnectAttempts: 0,
            maxReconnectAttempts: 5,
            reconnectInterval: 5000,
            events: [],
        };

        messageQueue.value = [];
        eventListeners.value.clear();
    };

    return {
        // State
        state: computed(() => state.value),
        messageQueue: computed(() => messageQueue.value),

        // Getters
        isConnected,
        isConnecting,
        connectionStatus,
        canReconnect,
        recentEvents,
        eventsByType,

        // Connection actions
        connect,
        disconnect,
        send,

        // Event management
        addEventListener,
        removeEventListener,
        removeAllEventListeners,
        getEventHistory,
        clearEventHistory,

        // Reconnection
        resetReconnectAttempts,
        setReconnectConfig,

        // Subscriptions
        subscribeToMachine,
        unsubscribeFromMachine,
        subscribeToYard,
        unsubscribeFromYard,

        // Utilities
        getConnectionStats,
        flushMessageQueue,
        clearMessageQueue,

        // Reset
        $reset,
    };
});

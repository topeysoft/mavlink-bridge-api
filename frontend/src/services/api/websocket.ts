// WebSocket connection manager for real-time updates
export type WebSocketEventType =
    | 'machine.status'
    | 'machine.location'
    | 'machine.battery'
    | 'machine.alert'
    | 'task.progress'
    | 'task.completed'
    | 'task.failed'
    | 'obstacle.detected'
    | 'weather.updated'
    | 'connection.status';

export interface WebSocketMessage {
    type: WebSocketEventType;
    data: any;
    timestamp: string;
    requestId?: string;
}

export interface WebSocketConfig {
    url: string;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
    heartbeatInterval?: number;
    protocols?: string[];
}

export type WebSocketEventListener = (data: any) => void;

export class WebSocketManager {
    private static instance: WebSocketManager;
    private ws: WebSocket | null = null;
    private config: WebSocketConfig;
    private listeners: Map<WebSocketEventType, Set<WebSocketEventListener>> = new Map();
    private reconnectAttempts = 0;
    private reconnectTimer: number | null = null;
    private heartbeatTimer: number | null = null;
    private isConnected = false;
    private shouldReconnect = true;

    private constructor(config: WebSocketConfig) {
        this.config = {
            reconnectInterval: 5000,
            maxReconnectAttempts: 10,
            heartbeatInterval: 30000,
            ...config,
        };
    }

    static getInstance (config?: WebSocketConfig): WebSocketManager {
        if (!WebSocketManager.instance && config) {
            WebSocketManager.instance = new WebSocketManager(config);
        } else if (!WebSocketManager.instance) {
            throw new Error('WebSocketManager must be initialized with config first');
        }
        return WebSocketManager.instance;
    }

    connect (): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.config.url, this.config.protocols);

                this.ws.onopen = () => {
                    console.log('🔌 WebSocket connected');
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    this.startHeartbeat();
                    this.emit('connection.status', { connected: true });
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    try {
                        const message: WebSocketMessage = JSON.parse(event.data);
                        this.handleMessage(message);
                    } catch (error) {
                        console.error('❌ Failed to parse WebSocket message:', error);
                    }
                };

                this.ws.onclose = (event) => {
                    console.log('🔌 WebSocket disconnected:', event.code, event.reason);
                    this.isConnected = false;
                    this.stopHeartbeat();
                    this.emit('connection.status', { connected: false, code: event.code, reason: event.reason });

                    if (this.shouldReconnect && this.reconnectAttempts < this.config.maxReconnectAttempts!) {
                        this.scheduleReconnect();
                    }
                };

                this.ws.onerror = (error) => {
                    console.error('❌ WebSocket error:', error);
                    reject(error);
                };
            } catch (error) {
                reject(error);
            }
        });
    }

    disconnect (): void {
        this.shouldReconnect = false;
        this.stopHeartbeat();

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.ws) {
            this.ws.close(1000, 'Manual disconnect');
            this.ws = null;
        }
    }

    send (type: WebSocketEventType, data: any): void {
        if (!this.isConnected || !this.ws) {
            console.warn('⚠️ WebSocket not connected, cannot send message');
            return;
        }

        const message: WebSocketMessage = {
            type,
            data,
            timestamp: new Date().toISOString(),
            requestId: this.generateRequestId(),
        };

        this.ws.send(JSON.stringify(message));
    }

    subscribe (eventType: WebSocketEventType, listener: WebSocketEventListener): () => void {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, new Set());
        }

        this.listeners.get(eventType)!.add(listener);

        // Return unsubscribe function
        return () => {
            const eventListeners = this.listeners.get(eventType);
            if (eventListeners) {
                eventListeners.delete(listener);
                if (eventListeners.size === 0) {
                    this.listeners.delete(eventType);
                }
            }
        };
    }

    unsubscribe (eventType: WebSocketEventType, listener?: WebSocketEventListener): void {
        if (!listener) {
            // Remove all listeners for this event type
            this.listeners.delete(eventType);
            return;
        }

        const eventListeners = this.listeners.get(eventType);
        if (eventListeners) {
            eventListeners.delete(listener);
            if (eventListeners.size === 0) {
                this.listeners.delete(eventType);
            }
        }
    }

    isWebSocketConnected (): boolean {
        return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
    }

    private handleMessage (message: WebSocketMessage): void {
        const listeners = this.listeners.get(message.type);
        if (listeners) {
            listeners.forEach(listener => {
                try {
                    listener(message.data);
                } catch (error) {
                    console.error(`❌ Error in WebSocket listener for ${message.type}:`, error);
                }
            });
        }
    }

    private emit (eventType: WebSocketEventType, data: any): void {
        this.handleMessage({
            type: eventType,
            data,
            timestamp: new Date().toISOString(),
        });
    }

    private scheduleReconnect (): void {
        this.reconnectAttempts++;
        const delay = Math.min(
            this.config.reconnectInterval! * Math.pow(2, this.reconnectAttempts - 1),
            30000 // Max 30 seconds
        );

        console.log(`🔄 Reconnecting WebSocket in ${delay}ms (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`);

        this.reconnectTimer = window.setTimeout(() => {
            this.connect().catch(error => {
                console.error('❌ WebSocket reconnection failed:', error);
            });
        }, delay);
    }

    private startHeartbeat (): void {
        if (this.config.heartbeatInterval && this.config.heartbeatInterval > 0) {
            this.heartbeatTimer = window.setInterval(() => {
                if (this.isConnected) {
                    this.send('connection.status', { type: 'ping' });
                }
            }, this.config.heartbeatInterval);
        }
    }

    private stopHeartbeat (): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    private generateRequestId (): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

// Helper function to initialize WebSocket with default config
export const initWebSocket = (baseUrl?: string): WebSocketManager => {
    const wsUrl = baseUrl || `ws://${window.location.hostname}:8080/ws`;
    return WebSocketManager.getInstance({
        url: wsUrl,
        reconnectInterval: 5000,
        maxReconnectAttempts: 10,
        heartbeatInterval: 30000,
    });
};

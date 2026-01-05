import { EventType, EventHandler, EventHandlers, WebSocketMessage } from './EventTypes';

// Get the appropriate WebSocket implementation based on environment
function getWebSocketImpl(): typeof WebSocket {
  if (typeof window !== 'undefined' && window.WebSocket) {
    // Browser environment - use native WebSocket
    return window.WebSocket as any;
  } else {
    // Node.js environment - use ws module
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ws = require('ws');
      return ws;
    } catch (e) {
      throw new Error('WebSocket not available. Please install ws package for Node.js environments.');
    }
  }
}

/**
 * WebSocket client for real-time communication with the ESP32 device
 * Works in both browser and Node.js environments
 */
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private readonly url: string;
  private readonly eventHandlers: Map<EventType, EventHandler[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isReconnecting = false;
  private shouldReconnect = true;

  constructor(url: string) {
    this.url = url;
    this.initializeEventHandlers();
  }

  /**
   * Initialize event handler storage for all event types
   */
  private initializeEventHandlers(): void {
    Object.values(EventType).forEach(eventType => {
      this.eventHandlers.set(eventType, []);
    });
  }

  /**
   * Connect to the WebSocket server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const WS = getWebSocketImpl();

      // Set a connection timeout to prevent indefinite hanging
      const connectionTimeout = setTimeout(() => {
        if (this.ws && this.ws.readyState === WS.CONNECTING) {
          // Browser WebSocket doesn't have terminate(), use close() instead
          if (typeof (this.ws as any).terminate === 'function') {
            (this.ws as any).terminate();
          } else {
            this.ws.close();
          }
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000); // 10 second timeout

      try {
        this.ws = new WS(this.url) as WebSocket;

        // Check if it's Node.js ws module (has .on method) or browser WebSocket
        const isNodeWS = typeof (this.ws as any).on === 'function';

        if (isNodeWS) {
          // Node.js ws module event handlers
          (this.ws as any).on('open', () => {
            clearTimeout(connectionTimeout);
            this.reconnectAttempts = 0;
            this.isReconnecting = false;
            resolve();
          });

          (this.ws as any).on('message', (data: any) => {
            this.handleMessage(data);
          });

          (this.ws as any).on('close', (code: number, reason: any) => {
            clearTimeout(connectionTimeout);
            this.handleClose(code, reason?.toString() || '');
          });

          (this.ws as any).on('error', (error: Error) => {
            clearTimeout(connectionTimeout);
            this.handleError(error);
            if (!this.isConnected()) {
              reject(error);
            }
          });
        } else {
          // Browser WebSocket event handlers
          this.ws.onopen = () => {
            clearTimeout(connectionTimeout);
            this.reconnectAttempts = 0;
            this.isReconnecting = false;
            resolve();
          };

          this.ws.onmessage = (event: MessageEvent) => {
            this.handleMessage(event.data);
          };

          this.ws.onclose = (event: CloseEvent) => {
            clearTimeout(connectionTimeout);
            this.handleClose(event.code, event.reason);
          };

          this.ws.onerror = (event: Event) => {
            clearTimeout(connectionTimeout);
            this.handleError(new Error('WebSocket connection error'));
            if (!this.isConnected()) {
              reject(new Error('WebSocket connection failed'));
            }
          };
        }

      } catch (error) {
        clearTimeout(connectionTimeout);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.shouldReconnect = false;
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    const WS = getWebSocketImpl();
    return this.ws?.readyState === WS.OPEN;
  }

  /**
   * Send a message to the server
   */
  send(message: WebSocketMessage): void {
    if (!this.isConnected()) {
      throw new Error('WebSocket is not connected');
    }

    try {
      const jsonMessage = JSON.stringify(message);
      this.ws!.send(jsonMessage);
    } catch (error) {
      throw new Error(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add an event handler for a specific event type
   */
  on<T extends EventType>(
    event: T, 
    handler: EventHandler<T extends keyof EventHandlers ? EventHandlers[T] extends EventHandler<infer P> ? P : unknown : unknown>
  ): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.push(handler as EventHandler);
    }
  }

  /**
   * Remove an event handler for a specific event type
   */
  off<T extends EventType>(
    event: T, 
    handler: EventHandler<T extends keyof EventHandlers ? EventHandlers[T] extends EventHandler<infer P> ? P : unknown : unknown>
  ): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler as EventHandler);
      if (index >= 0) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Remove all handlers for a specific event type
   */
  removeAllListeners(event?: EventType): void {
    if (event) {
      this.eventHandlers.set(event, []);
    } else {
      this.eventHandlers.forEach((handlers, eventType) => {
        this.eventHandlers.set(eventType, []);
      });
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: any): void {
    try {
      const messageStr = typeof data === 'string' ? data : data.toString();
      const message: WebSocketMessage = JSON.parse(messageStr);

      if (!this.isValidMessage(message)) {
        console.warn('Received invalid WebSocket message:', message);
        return;
      }

      const handlers = this.eventHandlers.get(message.type);
      if (handlers) {
        handlers.forEach(handler => {
          try {
            handler(message.payload);
          } catch (error) {
            console.error(`Error in event handler for ${message.type}:`, error);
          }
        });
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  /**
   * Validate incoming message structure
   */
  private isValidMessage(message: unknown): message is WebSocketMessage {
    if (typeof message !== 'object' || message === null) {
      return false;
    }

    const msg = message as Record<string, unknown>;
    
    return (
      typeof msg.type === 'string' &&
      Object.values(EventType).includes(msg.type as EventType) &&
      typeof msg.payload === 'object' &&
      msg.payload !== null
    );
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(code: number, reason: string): void {
    this.ws = null;

    if (this.shouldReconnect && !this.isReconnecting) {
      this.attemptReconnect();
    }
  }

  /**
   * Handle WebSocket error event
   */
  private handleError(error: Error): void {
    if (this.isConnected()) {
      console.error('WebSocket error while connected:', error.message);
    } else {
      // Only log detailed errors if verbose logging is enabled or during initial connection
      if (process.env.NODE_ENV === 'development') {
        console.error('WebSocket connection error:', error.message);
      }
    }
  }

  /**
   * Attempt to reconnect to the WebSocket server
   */
  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    setTimeout(async () => {
      try {
        await this.connect();
        console.log('WebSocket reconnected successfully');
      } catch (error) {
        console.error(`Reconnection attempt ${this.reconnectAttempts} failed:`, error);
        this.attemptReconnect();
      }
    }, delay);
  }

  /**
   * Set maximum reconnection attempts
   */
  setMaxReconnectAttempts(attempts: number): void {
    this.maxReconnectAttempts = Math.max(0, attempts);
  }

  /**
   * Set reconnection delay
   */
  setReconnectDelay(delay: number): void {
    this.reconnectDelay = Math.max(100, delay);
  }

  /**
   * Get current connection state
   */
  getConnectionState(): 'connecting' | 'open' | 'closing' | 'closed' {
    if (!this.ws) return 'closed';

    const WS = getWebSocketImpl();
    switch (this.ws.readyState) {
      case WS.CONNECTING: return 'connecting';
      case WS.OPEN: return 'open';
      case WS.CLOSING: return 'closing';
      case WS.CLOSED: return 'closed';
      default: return 'closed';
    }
  }
}
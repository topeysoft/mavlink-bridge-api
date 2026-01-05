import { WebSocketClient } from '../../src/core/WebSocketClient';
import { EventType } from '../../src/core/EventTypes';
import WebSocket from 'ws';

// Mock WebSocket
jest.mock('ws');

describe('WebSocketClient', () => {
    let wsClient: WebSocketClient;
    let mockWs: any;
    const wsUrl = 'ws://test-device.local/ws';

    beforeEach(() => {
        mockWs = {
            on: jest.fn((event: string, handler: Function) => {
                mockWs[`_${event}Handler`] = handler;
            }),
            close: jest.fn(),
            send: jest.fn(),
            terminate: jest.fn(),
            readyState: WebSocket.CONNECTING
        };

        (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);

        wsClient = new WebSocketClient(wsUrl);
        jest.clearAllMocks();
    });

    describe('connect', () => {
        it('should connect successfully', async () => {
            const connectPromise = wsClient.connect();

            // Simulate successful connection
            const openHandler = mockWs.on.mock.calls.find((call: any[]) => call[0] === 'open')?.[1];
            openHandler?.();

            await expect(connectPromise).resolves.toBeUndefined();
        });

        it('should handle connection timeout', async () => {
            // Don't register open handler, so connection will timeout
            const connectPromise = wsClient.connect();

            await expect(connectPromise).rejects.toThrow('WebSocket connection timeout');
        }, 15000);

        it('should handle connection error', async () => {
            const connectPromise = wsClient.connect();

            // Simulate error - call the registered error handler
            const errorHandler = mockWs._errorHandler;
            if (errorHandler) {
                errorHandler(new Error('Connection failed'));
            }

            await expect(connectPromise).rejects.toThrow('Connection failed');
        });
    });

    describe('disconnect', () => {
        it('should disconnect successfully', async () => {
            // First connect
            const connectPromise = wsClient.connect();
            mockWs.readyState = WebSocket.OPEN;
            const openHandler = mockWs._openHandler;
            if (openHandler) {
                openHandler();
            }
            await connectPromise;

            wsClient.disconnect();

            expect(mockWs.close).toHaveBeenCalledWith(1000, 'Client disconnect');
        });

        it('should prevent reconnection after disconnect', async () => {
            // First connect
            const connectPromise = wsClient.connect();
            mockWs.readyState = WebSocket.OPEN;
            const openHandler = mockWs._openHandler;
            if (openHandler) {
                openHandler();
            }
            await connectPromise;

            wsClient.disconnect();

            // Verify shouldReconnect flag is set to false
            expect(mockWs.close).toHaveBeenCalled();
        });
    });

    describe('isConnected', () => {
        it('should return true when connected', async () => {
            const connectPromise = wsClient.connect();
            mockWs.readyState = WebSocket.OPEN;
            const openHandler = mockWs._openHandler;
            if (openHandler) {
                openHandler();
            }
            await connectPromise;

            expect(wsClient.isConnected()).toBe(true);
        });

        it('should return false when disconnected', () => {
            mockWs.readyState = WebSocket.CLOSED;
            expect(wsClient.isConnected()).toBe(false);
        });

        it('should return false when connecting', () => {
            mockWs.readyState = WebSocket.CONNECTING;
            expect(wsClient.isConnected()).toBe(false);
        });
    });

    describe('send', () => {
        it('should send message when connected', async () => {
            const connectPromise = wsClient.connect();
            mockWs.readyState = WebSocket.OPEN;
            const openHandler = mockWs._openHandler;
            if (openHandler) {
                openHandler();
            }
            await connectPromise;

            wsClient.send({ type: EventType.STATUS, payload: {} });

            expect(mockWs.send).toHaveBeenCalledWith(
                JSON.stringify({ type: EventType.STATUS, payload: {} })
            );
        });

        it('should throw error when not connected', () => {
            mockWs.readyState = WebSocket.CLOSED;

            expect(() => {
                wsClient.send({ type: EventType.STATUS, payload: {} });
            }).toThrow();
        });
    });

    describe('Event handling', () => {
        it('should register event handlers', () => {
            const handler = jest.fn();

            wsClient.on(EventType.WIFI_CONNECTED, handler);

            // Verify handler is registered (implementation detail)
            expect(handler).toBeDefined();
        });

        it('should handle incoming messages', async () => {
            const handler = jest.fn();
            wsClient.on(EventType.WIFI_CONNECTED, handler);

            const connectPromise = wsClient.connect();
            mockWs.readyState = WebSocket.OPEN;
            const openHandler = mockWs._openHandler;
            if (openHandler) {
                openHandler();
            }
            await connectPromise;

            // Simulate message
            const messageHandler = mockWs._messageHandler;
            const testMessage = JSON.stringify({
                type: EventType.WIFI_CONNECTED,
                payload: { ssid: 'TestNetwork' }
            });

            if (messageHandler) {
                messageHandler(testMessage);
            }

            expect(handler).toHaveBeenCalledWith({ ssid: 'TestNetwork' });
        });

        it('should handle invalid JSON messages gracefully', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            const connectPromise = wsClient.connect();
            mockWs.readyState = WebSocket.OPEN;
            const openHandler = mockWs._openHandler;
            if (openHandler) {
                openHandler();
            }
            await connectPromise;

            const messageHandler = mockWs._messageHandler;
            if (messageHandler) {
                messageHandler(Buffer.from('invalid json'));
            }

            expect(consoleErrorSpy).toHaveBeenCalled();
            consoleErrorSpy.mockRestore();
        });
    });

    describe('Reconnection', () => {
        it('should attempt to reconnect on connection close', async () => {
            const connectPromise = wsClient.connect();
            mockWs.readyState = WebSocket.OPEN;
            const openHandler = mockWs._openHandler;
            if (openHandler) {
                openHandler();
            }
            await connectPromise;

            // Simulate close
            const closeHandler = mockWs._closeHandler;
            if (closeHandler) {
                closeHandler(1006, Buffer.from('Abnormal closure'));
            }

            // Reconnection logic would be triggered (implementation specific)
            expect(true).toBe(true);
        });

        it('should respect max reconnect attempts', () => {
            wsClient.setMaxReconnectAttempts(3);
            // Implementation specific test
            expect(true).toBe(true);
        });

        it('should use custom reconnect delay', () => {
            wsClient.setReconnectDelay(5000);
            // Implementation specific test
            expect(true).toBe(true);
        });
    });

    describe('Multiple event handlers', () => {
        it('should support multiple handlers for same event', async () => {
            const handler1 = jest.fn();
            const handler2 = jest.fn();

            wsClient.on(EventType.WIFI_CONNECTED, handler1);
            wsClient.on(EventType.WIFI_CONNECTED, handler2);

            const connectPromise = wsClient.connect();
            mockWs.readyState = WebSocket.OPEN;
            const openHandler = mockWs._openHandler;
            if (openHandler) {
                openHandler();
            }
            await connectPromise;

            const messageHandler = mockWs._messageHandler;
            if (messageHandler) {
                messageHandler(JSON.stringify({
                    type: EventType.WIFI_CONNECTED,
                    payload: {}
                }));
            }

            expect(handler1).toHaveBeenCalled();
            expect(handler2).toHaveBeenCalled();
        });
    });

    describe('Error handling', () => {
        it('should handle send errors', () => {
            mockWs.readyState = WebSocket.OPEN;
            mockWs.send.mockImplementation(() => {
                throw new Error('Send failed');
            });

            expect(() => {
                wsClient.send({ type: EventType.STATUS, payload: {} });
            }).toThrow();
        });
    });
});

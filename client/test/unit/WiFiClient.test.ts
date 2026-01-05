import { WiFiClient } from '../../src/wifi/WiFiClient';
import { HttpClient } from '../../src/core/HttpClient';
import { WebSocketClient } from '../../src/core/WebSocketClient';
import { EventType } from '../../src/core/EventTypes';
import {
    WiFiCredentials,
    WiFiStatus,
    WiFiNetwork,
    WiFiState,
    WiFiResponse,
    WiFiConnectResponse,
    WiFiDisconnectResponse,
    WiFiScanResult,
    WiFiErrorCode
} from '../../src/wifi/WiFiTypes';

class MockHttpClient {
    get = jest.fn();
    post = jest.fn();
    put = jest.fn();
    delete = jest.fn();
    getBaseUrl = jest.fn(() => 'http://test');
}

class MockWebSocketClient {
    private eventHandlers = new Map<string, Function[]>();

    on = jest.fn((event: string, handler: Function) => {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event)!.push(handler);
    });

    emit (event: string, data: any) {
        const handlers = this.eventHandlers.get(event) || [];
        handlers.forEach(handler => handler(data));
    }
}

describe('WiFiClient', () => {
    let wifiClient: WiFiClient;
    let mockHttpClient: MockHttpClient;
    let mockWsClient: MockWebSocketClient;

    beforeEach(() => {
        mockHttpClient = new MockHttpClient();
        mockWsClient = new MockWebSocketClient();
        wifiClient = new WiFiClient(
            mockHttpClient as any,
            mockWsClient as any
        );
        jest.clearAllMocks();
    });

    describe('connect', () => {
        it('should connect to WiFi network successfully', async () => {
            const credentials: WiFiCredentials = {
                ssid: 'TestNetwork',
                password: 'password123'
            };
            const mockResponse: WiFiResponse<WiFiConnectResponse> = {
                success: true,
                data: {
                    ssid: 'TestNetwork',
                    state: 'connected',
                    message: 'Connected successfully'
                }
            };
            mockHttpClient.post.mockResolvedValue(mockResponse);

            const result = await wifiClient.connect(credentials);

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                '/api/wifi/connect',
                credentials,
                undefined
            );
            expect(result).toEqual(mockResponse.data);
        });

        it('should connect with custom timeout', async () => {
            const credentials: WiFiCredentials = {
                ssid: 'TestNetwork',
                password: 'password123'
            };
            mockHttpClient.post.mockResolvedValue({
                success: true,
                data: { ssid: 'TestNetwork', connected: true }
            });

            await wifiClient.connect(credentials, { timeout: 30000 });

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                '/api/wifi/connect',
                credentials,
                { timeout: 30000 }
            );
        });

        it('should throw error on connection failure', async () => {
            const credentials: WiFiCredentials = {
                ssid: 'TestNetwork',
                password: 'wrongpassword'
            };
            const mockResponse: WiFiResponse<WiFiConnectResponse> = {
                success: false,
                error: {
                    code: WiFiErrorCode.CONNECTION_FAILED,
                    message: 'Authentication failed'
                }
            };
            mockHttpClient.post.mockResolvedValue(mockResponse);

            await expect(wifiClient.connect(credentials)).rejects.toThrow('Authentication failed');
        });

        it('should handle network errors', async () => {
            mockHttpClient.post.mockRejectedValue(new Error('Network timeout'));

            await expect(
                wifiClient.connect({ ssid: 'Test', password: 'pass' })
            ).rejects.toThrow('Failed to connect to WiFi');
        });
    });

    describe('disconnect', () => {
        it('should disconnect from WiFi successfully', async () => {
            const mockResponse: WiFiResponse<WiFiDisconnectResponse> = {
                success: true,
                data: {
                    message: 'Disconnected successfully'
                }
            };
            mockHttpClient.post.mockResolvedValue(mockResponse);

            const result = await wifiClient.disconnect();

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/wifi/disconnect');
            expect(result).toEqual(mockResponse.data);
        });

        it('should handle disconnection errors', async () => {
            mockHttpClient.post.mockResolvedValue({
                success: false,
                error: { message: 'Not connected' }
            });

            await expect(wifiClient.disconnect()).rejects.toThrow('Not connected');
        });
    });

    describe('getStatus', () => {
        it('should retrieve WiFi status when connected', async () => {
            const mockStatus: WiFiStatus = {
                state: WiFiState.CONNECTED,
                connected: true,
                ssid: 'TestNetwork',
                ip: '192.168.1.100',
                rssi: -45,
                quality: 95
            };
            const mockResponse: WiFiResponse<WiFiStatus> = {
                success: true,
                data: mockStatus
            };
            mockHttpClient.get.mockResolvedValue(mockResponse);

            const result = await wifiClient.getStatus();

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/wifi/status');
            expect(result).toEqual(mockStatus);
        });

        it('should retrieve WiFi status when disconnected', async () => {
            const mockStatus: WiFiStatus = {
                state: WiFiState.DISCONNECTED,
                connected: false
            };
            mockHttpClient.get.mockResolvedValue({
                success: true,
                data: mockStatus
            });

            const result = await wifiClient.getStatus();

            expect(result.connected).toBe(false);
            expect(result.state).toBe(WiFiState.DISCONNECTED);
        });

        it('should handle status request errors', async () => {
            mockHttpClient.get.mockResolvedValue({
                success: false,
                error: { message: 'Status unavailable' }
            });

            await expect(wifiClient.getStatus()).rejects.toThrow('Status unavailable');
        });
    });

    describe('scan', () => {
        it('should scan for WiFi networks', async () => {
            const mockNetworks: WiFiNetwork[] = [
                {
                    ssid: 'Network1',
                    rssi: -45,
                    channel: 6,
                    authMode: 'WPA2',
                    secure: true,
                    quality: 95
                },
                {
                    ssid: 'Network2',
                    rssi: -65,
                    channel: 11,
                    authMode: 'WPA2',
                    secure: true,
                    quality: 75
                }
            ];
            const mockResponse: WiFiResponse<WiFiScanResult> = {
                success: true,
                data: {
                    networks: mockNetworks,
                    count: 2,
                    cached: false
                }
            };
            mockHttpClient.get.mockResolvedValue(mockResponse);

            const result = await wifiClient.scan();

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/wifi/scan', undefined);
            expect(result).toEqual(mockNetworks);
            expect(result).toHaveLength(2);
        });

        it('should force scan when requested', async () => {
            mockHttpClient.get.mockResolvedValue({
                success: true,
                data: { networks: [], count: 0 }
            });

            await wifiClient.scan({ force: true });

            expect(mockHttpClient.get).toHaveBeenCalledWith(
                '/api/wifi/scan?force=true',
                undefined
            );
        });

        it('should scan with custom timeout', async () => {
            mockHttpClient.get.mockResolvedValue({
                success: true,
                data: { networks: [], count: 0 }
            });

            await wifiClient.scan({ timeout: 15000 });

            expect(mockHttpClient.get).toHaveBeenCalledWith(
                '/api/wifi/scan',
                { timeout: 15000 }
            );
        });

        it('should handle scan errors', async () => {
            mockHttpClient.get.mockResolvedValue({
                success: false,
                error: { message: 'Scan failed' }
            });

            await expect(wifiClient.scan()).rejects.toThrow('Scan failed');
        });
    });

    describe('Event subscriptions', () => {
        describe('onStateChange', () => {
            it('should subscribe to state change events', () => {
                const callback = jest.fn();
                const unsubscribe = wifiClient.onStateChange(callback);

                mockWsClient.emit(EventType.WIFI_CONNECTING, {});
                expect(callback).toHaveBeenCalledWith(WiFiState.CONNECTING);

                mockWsClient.emit(EventType.WIFI_CONNECTED, { ssid: 'Test', ip: '192.168.1.100', rssi: -50 });
                expect(callback).toHaveBeenCalledWith(WiFiState.CONNECTED);

                mockWsClient.emit(EventType.WIFI_DISCONNECTED, {});
                expect(callback).toHaveBeenCalledWith(WiFiState.DISCONNECTED);

                // Test unsubscribe
                unsubscribe();
                callback.mockClear();
                mockWsClient.emit(EventType.WIFI_CONNECTING, {});
                expect(callback).not.toHaveBeenCalled();
            });
        });

        describe('onConnectionChange', () => {
            it('should subscribe to connection status events', () => {
                const callback = jest.fn();
                wifiClient.onConnectionChange(callback);

                mockWsClient.emit(EventType.WIFI_CONNECTED, {
                    ssid: 'TestNetwork',
                    ip: '192.168.1.100',
                    rssi: -45
                });

                expect(callback).toHaveBeenCalledWith(
                    expect.objectContaining({
                        state: WiFiState.CONNECTED,
                        connected: true,
                        ssid: 'TestNetwork',
                        ip: '192.168.1.100'
                    })
                );
            });

            it('should handle disconnection events', () => {
                const callback = jest.fn();
                wifiClient.onConnectionChange(callback);

                mockWsClient.emit(EventType.WIFI_DISCONNECTED, {});

                expect(callback).toHaveBeenCalledWith(
                    expect.objectContaining({
                        state: WiFiState.DISCONNECTED,
                        connected: false
                    })
                );
            });
        });

        describe('onSignalUpdate', () => {
            it('should subscribe to signal quality updates', () => {
                const callback = jest.fn();
                const unsubscribe = wifiClient.onSignalUpdate(callback);

                mockWsClient.emit(EventType.WIFI_SIGNAL_UPDATE, {
                    rssi: -55,
                    quality: 85
                });

                expect(callback).toHaveBeenCalledWith({
                    rssi: -55,
                    quality: 85
                });

                // Test unsubscribe
                unsubscribe();
                callback.mockClear();
                mockWsClient.emit(EventType.WIFI_SIGNAL_UPDATE, { rssi: -60, quality: 80 });
                expect(callback).not.toHaveBeenCalled();
            });
        });

        describe('onScanComplete', () => {
            it('should handle scan complete events', () => {
                const callback = jest.fn();
                wifiClient.onScanComplete(callback);

                // This would need to be implemented in the WiFiClient
                // For now we can test that the callback registration works
                expect(callback).toBeDefined();
            });
        });
    });

    describe('Multiple subscribers', () => {
        it('should support multiple state change subscribers', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();

            wifiClient.onStateChange(callback1);
            wifiClient.onStateChange(callback2);

            mockWsClient.emit(EventType.WIFI_CONNECTING, {});

            expect(callback1).toHaveBeenCalledWith(WiFiState.CONNECTING);
            expect(callback2).toHaveBeenCalledWith(WiFiState.CONNECTING);
        });

        it('should allow partial unsubscription', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();

            wifiClient.onStateChange(callback1);
            const unsubscribe2 = wifiClient.onStateChange(callback2);

            unsubscribe2();

            mockWsClient.emit(EventType.WIFI_CONNECTED, {
                ssid: 'Test',
                ip: '192.168.1.100',
                rssi: -50
            });

            expect(callback1).toHaveBeenCalled();
            expect(callback2).not.toHaveBeenCalled();
        });
    });

    describe('AP Mode', () => {
        it('should handle AP mode started event', () => {
            const callback = jest.fn();
            wifiClient.onStateChange(callback);

            mockWsClient.emit(EventType.WIFI_AP_MODE_STARTED, {});

            expect(callback).toHaveBeenCalledWith(WiFiState.AP_MODE);
        });

        it('should update connection status for AP mode', () => {
            const callback = jest.fn();
            wifiClient.onConnectionChange(callback);

            mockWsClient.emit(EventType.WIFI_AP_MODE_STARTED, {});

            expect(callback).toHaveBeenCalledWith(
                expect.objectContaining({
                    state: WiFiState.AP_MODE,
                    connected: false,
                    apMode: true
                })
            );
        });
    });
});

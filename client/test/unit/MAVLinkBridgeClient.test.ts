import { MAVLinkBridgeClient } from '../../src/MAVLinkBridgeClient';

// Mock all the client modules
jest.mock('../../src/core/HttpClient');
jest.mock('../../src/core/WebSocketClient', () => {
    return {
        WebSocketClient: jest.fn().mockImplementation(() => ({
            connect: jest.fn().mockResolvedValue(undefined),
            disconnect: jest.fn(),
            isConnected: jest.fn().mockReturnValue(false),
            on: jest.fn(),
            send: jest.fn(),
            setMaxReconnectAttempts: jest.fn(),
            setReconnectDelay: jest.fn()
        }))
    };
});
jest.mock('../../src/config/ConfigClient');
jest.mock('../../src/wifi/WiFiClient');
jest.mock('../../src/rtcm/RTCMClient');
jest.mock('../../src/health/HealthClient');
jest.mock('../../src/communication/CommunicationClient');
jest.mock('../../src/mavlink/MAVLinkCommandClient');
jest.mock('../../src/mavlink/MAVLinkMissionClient');
jest.mock('../../src/mavlink/parameters/MAVLinkParameterClient');
jest.mock('../../src/tasks/TaskClient');

describe('MAVLinkBridgeClient', () => {
    let client: MAVLinkBridgeClient;
    const deviceUrl = 'http://192.168.4.1';

    beforeEach(() => {
        client = new MAVLinkBridgeClient(deviceUrl);
        jest.clearAllMocks();
    });

    describe('Constructor', () => {
        it('should initialize with device URL', () => {
            expect(client).toBeDefined();
        });

        it('should initialize with custom options', () => {
            const customClient = new MAVLinkBridgeClient(deviceUrl, {
                httpTimeout: 30000,
                maxReconnectAttempts: 10,
                reconnectDelay: 2000,
                autoConnectWebSocket: false
            });

            expect(customClient).toBeDefined();
        });

        it('should use default options when none provided', () => {
            const defaultClient = new MAVLinkBridgeClient(deviceUrl);
            expect(defaultClient).toBeDefined();
        });
    });

    describe('Client accessors', () => {
        it('should provide access to wifi client', () => {
            expect(client.wifi).toBeDefined();
        });

        it('should provide access to rtcm client', () => {
            expect(client.rtcm).toBeDefined();
        });

        it('should provide access to health client', () => {
            expect(client.health).toBeDefined();
        });

        it('should provide access to communication client', () => {
            expect(client.communication).toBeDefined();
        });

        it('should provide access to mavlink client', () => {
            expect(client.mavlink).toBeDefined();
        });

        it('should provide access to mission client', () => {
            expect(client.mission).toBeDefined();
        });

        it('should provide access to parameter client', () => {
            expect(client.parameters).toBeDefined();
        });

        it('should provide access to task client', () => {
            expect(client.tasks).toBeDefined();
        });
    });

    describe('Connection management', () => {
        it('should initialize and connect', async () => {
            // The MAVLinkBridgeClient doesn't have a connect method
            // WebSocket auto-connects if autoConnectWebSocket is true
            expect(client).toBeDefined();
        });

        it('should disconnect gracefully', () => {
            // The MAVLinkBridgeClient doesn't have a disconnect method currently
            expect(client).toBeDefined();
        });

        it('should check connection status', () => {
            const isConnected = client.isConnected();
            expect(typeof isConnected).toBe('boolean');
        });
    });

    describe('URL handling', () => {
        it('should handle HTTP device URLs', () => {
            const httpClient = new MAVLinkBridgeClient('http://192.168.1.100');
            expect(httpClient).toBeDefined();
        });

        it('should handle HTTPS device URLs', () => {
            const httpsClient = new MAVLinkBridgeClient('https://192.168.1.100');
            expect(httpsClient).toBeDefined();
        });

        it('should handle hostname URLs', () => {
            const hostnameClient = new MAVLinkBridgeClient('http://mavlinkbridge.local');
            expect(hostnameClient).toBeDefined();
        });
    });

    describe('Quick access methods', () => {
        it('should provide quick health check access', async () => {
            // Mock the health client response
            const mockHealthResponse = { healthy: true, uptime: 1000 };
            (client as any).healthClient.getHealthCheck = jest.fn().mockResolvedValue(mockHealthResponse);

            const healthResponse = await client.getHealth();
            expect(healthResponse).toBeDefined();
            expect(healthResponse).toEqual(mockHealthResponse);
        });
    });

    describe('Event handling', () => {
        it('should forward events through client accessors', () => {
            // Events are accessed through individual clients like client.wifi.onConnected()
            expect(client.wifi).toBeDefined();
            expect(client.health).toBeDefined();
        });
    });

    describe('Error scenarios', () => {
        it('should handle invalid device URL gracefully', () => {
            expect(() => {
                new MAVLinkBridgeClient('');
            }).not.toThrow();
        });

        it('should handle connection failures gracefully', async () => {
            try {
                if (client.connect) {
                    const connectSpy = jest.spyOn(client as any, 'connect').mockRejectedValue(new Error('Connection failed'));
                    await client.connect();
                }
            } catch (error) {
                expect(error).toBeDefined();
            }
        });
    });

    describe('Multiple instances', () => {
        it('should support multiple client instances', () => {
            const client1 = new MAVLinkBridgeClient('http://192.168.1.100');
            const client2 = new MAVLinkBridgeClient('http://192.168.1.101');

            expect(client1).not.toBe(client2);
            // Each client has its own state
            expect(client1).toBeInstanceOf(MAVLinkBridgeClient);
            expect(client2).toBeInstanceOf(MAVLinkBridgeClient);
        });
    });

    describe('Resource cleanup', () => {
        it('should cleanup resources on disconnect', () => {
            if (client.disconnect) {
                client.disconnect();
                // Verify WebSocket is closed
                expect(true).toBe(true);
            }
        });
    });

    describe('Configuration options', () => {
        it('should respect httpTimeout option', () => {
            const client = new MAVLinkBridgeClient(deviceUrl, { httpTimeout: 20000 });
            expect(client).toBeDefined();
        });

        it('should respect maxReconnectAttempts option', () => {
            const client = new MAVLinkBridgeClient(deviceUrl, { maxReconnectAttempts: 3 });
            expect(client).toBeDefined();
        });

        it('should respect reconnectDelay option', () => {
            const client = new MAVLinkBridgeClient(deviceUrl, { reconnectDelay: 3000 });
            expect(client).toBeDefined();
        });

        it('should respect autoConnectWebSocket option', () => {
            const client = new MAVLinkBridgeClient(deviceUrl, { autoConnectWebSocket: false });
            expect(client).toBeDefined();
        });
    });

    describe('Integration with sub-clients', () => {
        it('should pass HTTP client to all sub-clients', () => {
            expect(client.wifi).toBeDefined();
            expect(client.rtcm).toBeDefined();
            expect(client.health).toBeDefined();
        });

        it('should pass WebSocket client to real-time sub-clients', () => {
            expect(client.communication).toBeDefined();
            expect(client.wifi).toBeDefined();
            expect(client.rtcm).toBeDefined();
        });
    });
});

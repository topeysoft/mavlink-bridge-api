import { RTCMClient } from '../../src/rtcm/RTCMClient';
import { HttpClient } from '../../src/core/HttpClient';
import { WebSocketClient } from '../../src/core/WebSocketClient';
import { EventType } from '../../src/core/EventTypes';
import {
    RTCMConfig,
    RTCMStatus,
    RTCMResponse,
    RTCMState,
    RTCMDataEvent
} from '../../src/rtcm/RTCMTypes';

class MockHttpClient {
    get = jest.fn();
    post = jest.fn();
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

describe('RTCMClient', () => {
    let rtcmClient: RTCMClient;
    let mockHttpClient: MockHttpClient;
    let mockWsClient: MockWebSocketClient;

    beforeEach(() => {
        mockHttpClient = new MockHttpClient();
        mockWsClient = new MockWebSocketClient();
        rtcmClient = new RTCMClient(
            mockHttpClient as any,
            mockWsClient as any
        );
        jest.clearAllMocks();
    });

    describe('start', () => {
        it('should start RTCM client with configuration', async () => {
            const config: Partial<RTCMConfig> = {
                enabled: true,
                source: {
                    type: 'ntrip',
                    host: 'rtk2go.com',
                    port: 2101,
                    mountpoint: 'TEST',
                    username: 'user',
                    password: 'pass'
                },
                outputFormat: 'raw'
            };
            const mockResponse: RTCMResponse = {
                success: true,
                message: 'RTCM client started'
            };
            mockHttpClient.post.mockResolvedValue(mockResponse);

            const result = await rtcmClient.start(config);

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/rtcm/start', config);
            expect(result).toEqual(mockResponse);
        });

        it('should handle start errors', async () => {
            mockHttpClient.post.mockRejectedValue(new Error('Connection failed'));

            await expect(rtcmClient.start({ enabled: true })).rejects.toThrow('Connection failed');
        });
    });

    describe('stop', () => {
        it('should stop RTCM client', async () => {
            const mockResponse: RTCMResponse = {
                success: true,
                message: 'RTCM client stopped'
            };
            mockHttpClient.post.mockResolvedValue(mockResponse);

            const result = await rtcmClient.stop();

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/rtcm/stop');
            expect(result).toEqual(mockResponse);
        });
    });

    describe('getStatus', () => {
        it('should retrieve RTCM status', async () => {
            const mockStatus: RTCMStatus = {
                running: true,
                connected: true,
                state: RTCMState.CONNECTED,
                uptime: 3600000,
                clientType: 'ntrip'
            };
            mockHttpClient.get.mockResolvedValue(mockStatus);

            const result = await rtcmClient.getStatus();

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/rtcm/status');
            expect(result).toEqual(mockStatus);
        });
    });

    describe('getConfig', () => {
        it('should retrieve RTCM configuration', async () => {
            const mockConfig: RTCMConfig = {
                enabled: true,
                source: {
                    type: 'ntrip',
                    host: 'rtk2go.com',
                    port: 2101,
                    mountpoint: 'TEST'
                },
                outputFormat: 'raw'
            };
            mockHttpClient.get.mockResolvedValue(mockConfig);

            const result = await rtcmClient.getConfig();

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/rtcm/config');
            expect(result).toEqual(mockConfig);
        });
    });

    describe('startNTRIP', () => {
        it('should start NTRIP client with simplified configuration', async () => {
            const mockResponse: RTCMResponse = {
                success: true,
                message: 'NTRIP started'
            };
            mockHttpClient.post.mockResolvedValue(mockResponse);

            const result = await rtcmClient.startNTRIP({
                host: 'rtk2go.com',
                port: 2101,
                mountpoint: 'TEST',
                username: 'user',
                password: 'pass'
            });

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/rtcm/start',
                expect.objectContaining({
                    enabled: true,
                    source: expect.objectContaining({
                        type: 'ntrip',
                        host: 'rtk2go.com',
                        port: 2101,
                        mountpoint: 'TEST'
                    }),
                    outputFormat: 'raw'
                })
            );
            expect(result).toEqual(mockResponse);
        });

        it('should include position when sendPosition is true', async () => {
            mockHttpClient.post.mockResolvedValue({ success: true });

            await rtcmClient.startNTRIP({
                host: 'rtk2go.com',
                port: 2101,
                mountpoint: 'TEST',
                sendPosition: true,
                position: {
                    latitude: 37.7749,
                    longitude: -122.4194,
                    altitude: 10
                }
            });

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/rtcm/start',
                expect.objectContaining({
                    source: expect.objectContaining({
                        position: {
                            latitude: 37.7749,
                            longitude: -122.4194,
                            altitude: 10
                        }
                    })
                })
            );
        });
    });

    describe('startTCP', () => {
        it('should start TCP RTCM client', async () => {
            const mockResponse: RTCMResponse = {
                success: true,
                message: 'TCP client started'
            };
            mockHttpClient.post.mockResolvedValue(mockResponse);

            const result = await rtcmClient.startTCP('192.168.1.100', 5000);

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/rtcm/start', {
                enabled: true,
                source: {
                    type: 'tcp',
                    host: '192.168.1.100',
                    port: 5000
                },
                outputFormat: 'raw'
            });
            expect(result).toEqual(mockResponse);
        });
    });

    describe('startUDP', () => {
        it('should start UDP RTCM client with local port only', async () => {
            const mockResponse: RTCMResponse = {
                success: true,
                message: 'UDP client started'
            };
            mockHttpClient.post.mockResolvedValue(mockResponse);

            const result = await rtcmClient.startUDP(14550);

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/rtcm/start', {
                enabled: true,
                source: {
                    type: 'udp',
                    port: 14550
                },
                outputFormat: 'raw'
            });
            expect(result).toEqual(mockResponse);
        });

        it('should start UDP RTCM client with remote host and port', async () => {
            mockHttpClient.post.mockResolvedValue({ success: true });

            await rtcmClient.startUDP(14550, '192.168.1.100', 14551);

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/rtcm/start', {
                enabled: true,
                source: {
                    type: 'udp',
                    port: 14550,
                    remoteHost: '192.168.1.100',
                    remotePort: 14551
                },
                outputFormat: 'raw'
            });
        });
    });

    describe('Event subscriptions', () => {
        describe('onDataReceived', () => {
            it('should subscribe to RTCM data events', () => {
                const callback = jest.fn();
                const unsubscribe = rtcmClient.onDataReceived(callback);

                const dataEvent: RTCMDataEvent = {
                    type: 'rtcm_data',
                    messageType: 1005,
                    messageName: 'RTK Base Station ARP',
                    length: 64,
                    stationId: 1234
                };

                mockWsClient.emit(EventType.RTCM_DATA_RECEIVED, dataEvent);

                expect(callback).toHaveBeenCalledWith(dataEvent);

                // Test unsubscribe
                unsubscribe();
                callback.mockClear();
                mockWsClient.emit(EventType.RTCM_DATA_RECEIVED, dataEvent);
                expect(callback).not.toHaveBeenCalled();
            });

            it('should support multiple subscribers', () => {
                const callback1 = jest.fn();
                const callback2 = jest.fn();

                rtcmClient.onDataReceived(callback1);
                rtcmClient.onDataReceived(callback2);

                const dataEvent: RTCMDataEvent = {
                    type: 'rtcm_data',
                    messageType: 1077,
                    messageName: 'GPS MSM7',
                    length: 128
                };

                mockWsClient.emit(EventType.RTCM_DATA_RECEIVED, dataEvent);

                expect(callback1).toHaveBeenCalledWith(dataEvent);
                expect(callback2).toHaveBeenCalledWith(dataEvent);
            });
        });

        describe('onStateChange', () => {
            it('should subscribe to state change events', () => {
                const callback = jest.fn();
                const unsubscribe = rtcmClient.onStateChange(callback);

                mockWsClient.emit(EventType.RTCM_STATE_CHANGE, { state: 2 });

                expect(callback).toHaveBeenCalledWith(RTCMState.CONNECTED);

                // Test unsubscribe
                unsubscribe();
                callback.mockClear();
                mockWsClient.emit(EventType.RTCM_STATE_CHANGE, { state: 0 });
                expect(callback).not.toHaveBeenCalled();
            });

            it('should correctly map state numbers to enums', () => {
                const callback = jest.fn();
                rtcmClient.onStateChange(callback);

                mockWsClient.emit(EventType.RTCM_STATE_CHANGE, { state: 0 });
                expect(callback).toHaveBeenCalledWith(RTCMState.DISCONNECTED);

                mockWsClient.emit(EventType.RTCM_STATE_CHANGE, { state: 1 });
                expect(callback).toHaveBeenCalledWith(RTCMState.CONNECTING);

                mockWsClient.emit(EventType.RTCM_STATE_CHANGE, { state: 2 });
                expect(callback).toHaveBeenCalledWith(RTCMState.CONNECTED);

                mockWsClient.emit(EventType.RTCM_STATE_CHANGE, { state: 3 });
                expect(callback).toHaveBeenCalledWith(RTCMState.ERROR);
            });

            it('should handle unknown state numbers', () => {
                const callback = jest.fn();
                rtcmClient.onStateChange(callback);

                mockWsClient.emit(EventType.RTCM_STATE_CHANGE, { state: 99 });
                expect(callback).toHaveBeenCalledWith(RTCMState.DISCONNECTED);
            });
        });
    });

    describe('Unsubscribe functionality', () => {
        it('should properly remove specific callback', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();

            rtcmClient.onDataReceived(callback1);
            const unsubscribe2 = rtcmClient.onDataReceived(callback2);

            unsubscribe2();

            const dataEvent: RTCMDataEvent = {
                type: 'rtcm_data',
                messageType: 1005,
                messageName: 'RTK Base Station ARP',
                length: 64
            };

            mockWsClient.emit(EventType.RTCM_DATA_RECEIVED, dataEvent);

            expect(callback1).toHaveBeenCalled();
            expect(callback2).not.toHaveBeenCalled();
        });
    });
});

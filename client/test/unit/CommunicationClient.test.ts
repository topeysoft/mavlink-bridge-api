import { CommunicationClient } from '../../src/communication/CommunicationClient';
import { HttpClient } from '../../src/core/HttpClient';
import { WebSocketClient } from '../../src/core/WebSocketClient';
import { EventType } from '../../src/core/EventTypes';
import {
    Interface,
    RoutingMode,
    InterfaceChangeEvent,
    DataFlowStats,
    CommunicationStats,
    MAVLinkMessage,
    CommunicationError,
    CommunicationErrorType,
    CommunicationStatus
} from '../../src/communication/CommunicationTypes';

// Mock classes
class MockHttpClient {
    get = jest.fn();
    post = jest.fn();
    patch = jest.fn();
    put = jest.fn();
    delete = jest.fn();
    getBaseUrl = jest.fn(() => 'http://test');
    setTimeout = jest.fn();
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

    connect = jest.fn();
    disconnect = jest.fn();
    isConnected = jest.fn(() => true);
}

describe('CommunicationClient', () => {
    let communicationClient: CommunicationClient;
    let mockHttpClient: MockHttpClient;
    let mockWsClient: MockWebSocketClient;

    beforeEach(() => {
        mockHttpClient = new MockHttpClient();
        mockWsClient = new MockWebSocketClient();
        communicationClient = new CommunicationClient(
            mockHttpClient as any,
            mockWsClient as any
        );
        jest.clearAllMocks();
    });

    describe('HTTP API methods', () => {
        describe('getStatus', () => {
            it('should retrieve communication status', async () => {
                const mockStatus: CommunicationStatus = {
                    initialized: true,
                    activeInterface: Interface.USB_OTG,
                    routingMode: RoutingMode.AUTO,
                    interfacesAvailable: [Interface.USB_OTG, Interface.UART],
                    lastActivity: Date.now(),
                    uptime: 3600000
                };
                mockHttpClient.get.mockResolvedValue(mockStatus);

                const result = await communicationClient.getStatus();

                expect(mockHttpClient.get).toHaveBeenCalledWith('/api/communication/status');
                expect(result).toEqual(mockStatus);
            });
        });

        describe('getStatistics', () => {
            it('should retrieve communication statistics', async () => {
                const mockStats: CommunicationStats = {
                    activeInterface: Interface.USB_OTG,
                    routingMode: RoutingMode.AUTO,
                    dataFlow: {
                        interface: Interface.USB_OTG,
                        upstreamRate: 1024,
                        downstreamRate: 2048,
                        packetsReceived: 1000,
                        packetsSent: 800,
                        bytesReceived: 500000,
                        bytesSent: 400000,
                        interfaceSwitches: 5,
                        lastSwitchMs: 60000
                    },
                    usb: {
                        connected: true,
                        state: 'connected',
                        bytesReceived: 500000,
                        bytesSent: 400000,
                        packetsReceived: 1000,
                        packetsSent: 800,
                        dataRate: 1024
                    },
                    uart: {
                        connected: false,
                        baudRate: 115200,
                        bytesReceived: 0,
                        bytesSent: 0,
                        packetsReceived: 0,
                        packetsSent: 0,
                        dataRate: 0,
                        crcErrors: 0,
                        framingErrors: 0,
                        mavlinkDetected: false
                    },
                    mavlink: {
                        totalMessages: 1000,
                        crcErrors: 0,
                        parseErrors: 0,
                        sequenceErrors: 0,
                        messageTypes: {},
                        processingEnabled: true,
                        filterEnabled: false
                    }
                };
                mockHttpClient.get.mockResolvedValue(mockStats);

                const result = await communicationClient.getStatistics();

                expect(mockHttpClient.get).toHaveBeenCalledWith('/api/communication/statistics');
                expect(result).toEqual(mockStats);
            });
        });

        describe('setRoutingMode', () => {
            it('should set routing mode', async () => {
                mockHttpClient.post.mockResolvedValue(undefined);

                await communicationClient.setRoutingMode(RoutingMode.USB_ONLY);

                expect(mockHttpClient.post).toHaveBeenCalledWith('/api/communication/routing', {
                    mode: RoutingMode.USB_ONLY
                });
            });
        });
    });

    describe('Event subscriptions', () => {
        describe('onInterfaceChange', () => {
            it('should subscribe to interface change events', () => {
                const callback = jest.fn();
                const unsubscribe = communicationClient.onInterfaceChange(callback);

                const event: InterfaceChangeEvent = {
                    from: Interface.NONE,
                    to: Interface.USB_OTG,
                    reason: 'usb_connected',
                    timestamp: Date.now()
                };

                mockWsClient.emit(EventType.USB_CONNECTED, {});

                expect(callback).toHaveBeenCalled();

                // Unsubscribe should work
                unsubscribe();
                callback.mockClear();
                mockWsClient.emit(EventType.USB_CONNECTED, {});
                expect(callback).not.toHaveBeenCalled();
            });

            it('should handle USB disconnection events', () => {
                const callback = jest.fn();
                communicationClient.onInterfaceChange(callback);

                mockWsClient.emit(EventType.USB_DISCONNECTED, {});

                expect(callback).toHaveBeenCalledWith(
                    expect.objectContaining({
                        from: Interface.USB_OTG,
                        to: Interface.NONE,
                        reason: 'usb_disconnected'
                    })
                );
            });

            it('should handle UART connection events', () => {
                const callback = jest.fn();
                communicationClient.onInterfaceChange(callback);

                mockWsClient.emit(EventType.UART_CONNECTED, {});

                expect(callback).toHaveBeenCalledWith(
                    expect.objectContaining({
                        to: Interface.UART,
                        reason: 'uart_connected'
                    })
                );
            });

            it('should handle interface switched events', () => {
                const callback = jest.fn();
                communicationClient.onInterfaceChange(callback);

                mockWsClient.emit(EventType.INTERFACE_SWITCHED, {
                    from: Interface.USB_OTG,
                    to: Interface.UART,
                    reason: 'signal_quality'
                });

                expect(callback).toHaveBeenCalledWith(
                    expect.objectContaining({
                        from: Interface.USB_OTG,
                        to: Interface.UART,
                        reason: 'signal_quality'
                    })
                );
            });
        });

        describe('onMAVLinkMessage', () => {
            it('should subscribe to MAVLink message events', () => {
                const callback = jest.fn();
                communicationClient.onMAVLinkMessage(callback);

                mockWsClient.emit(EventType.MAVLINK_MESSAGE, {
                    messageId: 0,
                    systemId: 1,
                    componentId: 1,
                    length: 31,
                    data: 'base64data'
                });

                expect(callback).toHaveBeenCalledWith(
                    expect.objectContaining({
                        messageId: 0,
                        systemId: 1,
                        componentId: 1,
                        valid: true
                    })
                );
            });
        });

        describe('onDataFlow', () => {
            it('should subscribe to data flow statistics events', () => {
                const callback = jest.fn();
                communicationClient.onDataFlow(callback);

                mockWsClient.emit(EventType.COMMUNICATION_STATS, {
                    interface: Interface.USB_OTG,
                    upstreamRate: 1024,
                    downstreamRate: 2048,
                    packetsReceived: 100,
                    packetsSent: 80,
                    bytesReceived: 10000,
                    bytesSent: 8000
                });

                expect(callback).toHaveBeenCalledWith(
                    expect.objectContaining({
                        interface: Interface.USB_OTG,
                        upstreamRate: 1024,
                        downstreamRate: 2048
                    })
                );
            });
        });

        describe('onError', () => {
            it('should subscribe to communication error events', () => {
                const callback = jest.fn();
                communicationClient.onError(callback);

                mockWsClient.emit(EventType.ERROR, {
                    component: 'communication',
                    message: 'Interface error',
                    timestamp: Date.now()
                });

                expect(callback).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: CommunicationErrorType.INTERFACE_ERROR,
                        message: 'Interface error'
                    })
                );
            });

            it('should ignore errors from other components', () => {
                const callback = jest.fn();
                communicationClient.onError(callback);

                mockWsClient.emit(EventType.ERROR, {
                    component: 'wifi',
                    message: 'WiFi error',
                    timestamp: Date.now()
                });

                expect(callback).not.toHaveBeenCalled();
            });
        });
    });

    describe('Error handling in callbacks', () => {
        it('should handle errors in interface change callbacks gracefully', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            const errorCallback = jest.fn(() => {
                throw new Error('Callback error');
            });
            const normalCallback = jest.fn();

            communicationClient.onInterfaceChange(errorCallback);
            communicationClient.onInterfaceChange(normalCallback);

            mockWsClient.emit(EventType.USB_CONNECTED, {});

            expect(errorCallback).toHaveBeenCalled();
            expect(normalCallback).toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });
    });

    describe('Multiple subscribers', () => {
        it('should support multiple subscribers to the same event', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            const callback3 = jest.fn();

            communicationClient.onInterfaceChange(callback1);
            communicationClient.onInterfaceChange(callback2);
            communicationClient.onInterfaceChange(callback3);

            mockWsClient.emit(EventType.USB_CONNECTED, {});

            expect(callback1).toHaveBeenCalled();
            expect(callback2).toHaveBeenCalled();
            expect(callback3).toHaveBeenCalled();
        });

        it('should allow partial unsubscription', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();

            communicationClient.onInterfaceChange(callback1);
            const unsubscribe2 = communicationClient.onInterfaceChange(callback2);

            unsubscribe2();

            mockWsClient.emit(EventType.USB_CONNECTED, {});

            expect(callback1).toHaveBeenCalled();
            expect(callback2).not.toHaveBeenCalled();
        });
    });
});

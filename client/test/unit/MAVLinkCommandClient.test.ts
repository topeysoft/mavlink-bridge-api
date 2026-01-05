import { MAVLinkCommandClient } from '../../src/mavlink/MAVLinkCommandClient';
import { HttpClient } from '../../src/core/HttpClient';
import {
    MAVLinkCommandResponse,
    ArduPilotMode,
    MAVCommand
} from '../../src/mavlink/MAVLinkTypes';

class MockHttpClient {
    post = jest.fn();
    getBaseUrl = jest.fn(() => 'http://test');
}

describe('MAVLinkCommandClient', () => {
    let commandClient: MAVLinkCommandClient;
    let mockHttpClient: MockHttpClient;

    beforeEach(() => {
        mockHttpClient = new MockHttpClient();
        commandClient = new MAVLinkCommandClient(mockHttpClient as any);
        jest.clearAllMocks();
    });

    describe('arm', () => {
        it('should send arm command', async () => {
            const mockResponse: MAVLinkCommandResponse = {
                success: true,
                commandType: 'arm',
                targetSystem: 1,
                targetComponent: 1,
                messageId: 76,
                bytesSent: 33
            };
            mockHttpClient.post.mockResolvedValue(mockResponse);

            const result = await commandClient.arm();

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/mavlink/command',
                expect.objectContaining({
                    commandType: 'arm',
                    targetSystem: 1,
                    targetComponent: 1
                })
            );
            expect(result).toEqual(mockResponse);
        });

        it('should send arm command with custom target', async () => {
            mockHttpClient.post.mockResolvedValue({ success: true });

            await commandClient.arm({ targetSystem: 2, targetComponent: 3 });

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/mavlink/command',
                expect.objectContaining({
                    targetSystem: 2,
                    targetComponent: 3
                })
            );
        });
    });

    describe('disarm', () => {
        it('should send disarm command', async () => {
            const mockResponse: MAVLinkCommandResponse = {
                success: true,
                commandType: 'disarm',
                targetSystem: 1,
                targetComponent: 1,
                messageId: 76,
                bytesSent: 33
            };
            mockHttpClient.post.mockResolvedValue(mockResponse);

            const result = await commandClient.disarm();

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/mavlink/command',
                expect.objectContaining({
                    commandType: 'disarm'
                })
            );
            expect(result).toEqual(mockResponse);
        });
    });

    describe('setMode', () => {
        it('should set flight mode with custom mode number', async () => {
            mockHttpClient.post.mockResolvedValue({ success: true });

            await commandClient.setMode(4); // GUIDED mode

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/mavlink/command',
                expect.objectContaining({
                    commandType: 'setMode',
                    customMode: 4
                })
            );
        });

        it('should set flight mode with ArduPilot mode enum', async () => {
            mockHttpClient.post.mockResolvedValue({ success: true });

            await commandClient.setMode(ArduPilotMode.AUTO);

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/mavlink/command',
                expect.objectContaining({
                    commandType: 'setMode',
                    customMode: ArduPilotMode.AUTO
                })
            );
        });
    });

    describe('sendCommandLong', () => {
        it('should send COMMAND_LONG with all parameters', async () => {
            mockHttpClient.post.mockResolvedValue({ success: true });

            await commandClient.sendCommandLong({
                command: 176, // MAV_CMD_DO_SET_MODE
                param1: 1,
                param2: 4,
                param3: 0,
                param4: 0,
                param5: 0,
                param6: 0,
                param7: 0
            });

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/mavlink/command',
                expect.objectContaining({
                    commandType: 'commandLong',
                    command: 176,
                    param1: 1,
                    param2: 4
                })
            );
        });
    });

    describe('sendCommandInt', () => {
        it('should send COMMAND_INT with coordinates', async () => {
            mockHttpClient.post.mockResolvedValue({ success: true });

            await commandClient.sendCommandInt({
                command: 192, // MAV_CMD_DO_REPOSITION
                x: 377490000,
                y: -1224194000,
                z: 100
            });

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/mavlink/command',
                expect.objectContaining({
                    commandType: 'commandInt',
                    command: 192,
                    x: 377490000,
                    y: -1224194000,
                    z: 100
                })
            );
        });
    });

    describe('setPositionTarget', () => {
        it('should set position target in local NED', async () => {
            mockHttpClient.post.mockResolvedValue({ success: true });

            await commandClient.setPositionTarget({
                x: 10,
                y: 20,
                z: -30,
                vx: 1,
                vy: 0,
                vz: -0.5
            });

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/mavlink/command',
                expect.objectContaining({
                    commandType: 'setPositionTarget',
                    x: 10,
                    y: 20,
                    z: -30,
                    vx: 1,
                    vy: 0,
                    vz: -0.5
                })
            );
        });
    });

    describe('takeoff', () => {
        it('should send takeoff command with altitude', async () => {
            mockHttpClient.post.mockResolvedValue({ success: true });

            await commandClient.takeoff(10);

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/mavlink/command',
                expect.objectContaining({
                    commandType: 'commandLong',
                    command: MAVCommand.COMPONENT_ARM_DISARM,
                    param7: 10
                })
            );
        });
    });

    describe('returnToLaunch', () => {
        it('should set RTL mode', async () => {
            mockHttpClient.post.mockResolvedValue({ success: true });

            await commandClient.returnToLaunch();

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/mavlink/command',
                expect.objectContaining({
                    commandType: 'setMode',
                    customMode: ArduPilotMode.RTL
                })
            );
        });
    });

    describe('land', () => {
        it('should set LAND mode', async () => {
            mockHttpClient.post.mockResolvedValue({ success: true });

            await commandClient.land();

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/mavlink/command',
                expect.objectContaining({
                    commandType: 'setMode',
                    customMode: ArduPilotMode.LAND
                })
            );
        });
    });

    describe('setHomeHere', () => {
        it('should set home to current location', async () => {
            mockHttpClient.post.mockResolvedValue({ success: true });

            await commandClient.setHomeHere();

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/mavlink/command',
                expect.objectContaining({
                    commandType: 'commandLong',
                    command: MAVCommand.DO_SET_HOME,
                    param1: 1
                })
            );
        });
    });

    describe('requestCapabilities', () => {
        it('should request autopilot capabilities', async () => {
            mockHttpClient.post.mockResolvedValue({ success: true });

            await commandClient.requestCapabilities();

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/mavlink/command',
                expect.objectContaining({
                    commandType: 'commandLong',
                    command: MAVCommand.REQUEST_AUTOPILOT_CAPABILITIES,
                    param1: 1
                })
            );
        });
    });

    describe('Error handling', () => {
        it('should handle command errors', async () => {
            mockHttpClient.post.mockRejectedValue(new Error('Command failed'));

            await expect(commandClient.arm()).rejects.toThrow('Command failed');
        });

        it('should handle failed command response', async () => {
            const mockResponse: MAVLinkCommandResponse = {
                success: false,
                commandType: 'arm',
                targetSystem: 1,
                targetComponent: 1,
                messageId: 76,
                bytesSent: 33
            };
            mockHttpClient.post.mockResolvedValue(mockResponse);

            const result = await commandClient.arm();

            expect(result.success).toBe(false);
        });
    });
});

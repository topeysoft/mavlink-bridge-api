import { MAVLinkMissionClient } from '../../src/mavlink/MAVLinkMissionClient';
import { HttpClient } from '../../src/core/HttpClient';
import { WebSocketClient } from '../../src/core/WebSocketClient';
import { EventType } from '../../src/core/EventTypes';
import {
    MissionPlan,
    MissionItem,
    MissionOperationResult,
    MAVFrame,
    MAVMissionType
} from '../../src/mavlink/MAVLinkMissionTypes';

class MockHttpClient {
    post = jest.fn();
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

describe('MAVLinkMissionClient', () => {
    let missionClient: MAVLinkMissionClient;
    let mockHttpClient: MockHttpClient;
    let mockWsClient: MockWebSocketClient;

    beforeEach(() => {
        mockHttpClient = new MockHttpClient();
        mockWsClient = new MockWebSocketClient();
        missionClient = new MAVLinkMissionClient(
            mockHttpClient as any,
            mockWsClient as any
        );
        jest.clearAllMocks();
    });

    describe('uploadMission', () => {
        it('should upload mission successfully', async () => {
            const missionPlan: MissionPlan = {
                items: [
                    {
                        seq: 0,
                        frame: MAVFrame.MAV_FRAME_GLOBAL_RELATIVE_ALT_INT,
                        command: 22, // TAKEOFF
                        current: 1,
                        autocontinue: 1,
                        param1: 0,
                        param2: 0,
                        param3: 0,
                        param4: 0,
                        x: 377490000,
                        y: -1224194000,
                        z: 10,
                        missionType: MAVMissionType.MAV_MISSION_TYPE_MISSION
                    }
                ],
                targetSystem: 1,
                targetComponent: 1
            };
            const mockResult: MissionOperationResult = {
                success: true,
                operation: 'upload',
                itemsProcessed: 1,
                targetSystem: 1,
                targetComponent: 1
            };
            mockHttpClient.post.mockResolvedValue(mockResult);

            const result = await missionClient.uploadMission(missionPlan);

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                '/api/mavlink/mission/upload',
                expect.objectContaining({
                    items: missionPlan.items,
                    count: 1
                })
            );
            expect(result).toEqual(mockResult);
        });

        it('should prevent concurrent uploads', async () => {
            mockHttpClient.post.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100)));

            const promise1 = missionClient.uploadMission({ items: [], targetSystem: 1, targetComponent: 1 });
            const promise2 = missionClient.uploadMission({ items: [], targetSystem: 1, targetComponent: 1 });

            await expect(promise2).rejects.toThrow('Mission upload already in progress');
            await promise1;
        });
    });

    describe('downloadMission', () => {
        it('should download mission successfully', async () => {
            const mockItems: MissionItem[] = [
                {
                    seq: 0,
                    frame: MAVFrame.MAV_FRAME_GLOBAL_RELATIVE_ALT_INT,
                    command: 16,
                    current: 0,
                    autocontinue: 1,
                    param1: 0,
                    param2: 0,
                    param3: 0,
                    param4: 0,
                    x: 377490000,
                    y: -1224194000,
                    z: 50,
                    missionType: MAVMissionType.MAV_MISSION_TYPE_MISSION
                }
            ];
            mockHttpClient.post.mockResolvedValue({ items: mockItems });

            const result = await missionClient.downloadMission();

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                '/api/mavlink/mission/download',
                expect.objectContaining({
                    targetSystem: 1,
                    targetComponent: 1
                })
            );
            expect(result.items).toEqual(mockItems);
        });

        it('should prevent concurrent downloads', async () => {
            mockHttpClient.post.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ items: [] }), 100)));

            const promise1 = missionClient.downloadMission();
            const promise2 = missionClient.downloadMission();

            await expect(promise2).rejects.toThrow('Mission download already in progress');
            await promise1;
        });
    });

    describe('clearMission', () => {
        it('should clear mission', async () => {
            mockHttpClient.post.mockResolvedValue({ success: true });

            await missionClient.clearMission();

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                '/api/mavlink/mission/clear',
                expect.objectContaining({
                    targetSystem: 1,
                    targetComponent: 1
                })
            );
        });
    });

    describe('startMission', () => {
        it('should start mission', async () => {
            mockHttpClient.post.mockResolvedValue({ success: true });

            await missionClient.startMission();

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                '/api/mavlink/command',
                expect.objectContaining({
                    commandType: 'commandLong'
                })
            );
        });
    });

    describe('pauseMission', () => {
        it('should pause mission', async () => {
            mockHttpClient.post.mockResolvedValue({ success: true });

            await missionClient.pauseMission();

            expect(mockHttpClient.post).toHaveBeenCalled();
        });
    });

    describe('resumeMission', () => {
        it('should resume mission', async () => {
            mockHttpClient.post.mockResolvedValue({ success: true });

            await missionClient.resumeMission();

            expect(mockHttpClient.post).toHaveBeenCalled();
        });
    });

    describe('setCurrentMissionItem', () => {
        it('should set current mission item', async () => {
            mockHttpClient.post.mockResolvedValue({ success: true });

            await missionClient.setCurrentMissionItem(5);

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                '/api/mavlink/mission/set_current',
                expect.objectContaining({
                    seq: 5
                })
            );
        });
    });

    describe('requestMissionStatus', () => {
        it('should request mission status', async () => {
            const mockStatus = {
                current: 3,
                reached: 2,
                total: 10
            };
            mockHttpClient.post.mockResolvedValue(mockStatus);

            const result = await missionClient.requestMissionStatus();

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/mavlink/mission/status',
                expect.anything()
            );
            expect(result).toEqual(mockStatus);
        });
    });

    describe('Mission item creation', () => {
        it('should create waypoint mission item', () => {
            const waypoint = missionClient.createWaypoint({
                seq: 1,
                lat: 37.7749,
                lng: -122.4194,
                alt: 50,
                loiterTime: 10,
                acceptanceRadius: 5
            });

            expect(waypoint.seq).toBe(1);
            expect(waypoint.command).toBe(16);
            expect(waypoint.lat).toBe(37.7749);
            expect(waypoint.lng).toBe(-122.4194);
            expect(waypoint.alt).toBe(50);
            expect(waypoint.param1).toBe(10);
            expect(waypoint.param2).toBe(5);
        });

        it('should create takeoff item', () => {
            const takeoff = missionClient.createTakeoffItem(37.7749, -122.4194, 10, 0);

            expect(takeoff.seq).toBe(0);
            expect(takeoff.command).toBe(22);
            expect(takeoff.z).toBe(10);
        });

        it('should create land item', () => {
            const land = missionClient.createLandItem(37.7749, -122.4194, 5);

            expect(land.seq).toBe(5);
            expect(land.command).toBe(21);
            expect(land.z).toBe(0);
        });

        it('should create RTL item', () => {
            const rtl = missionClient.createReturnToLaunchItem(10);

            expect(rtl.seq).toBe(10);
            expect(rtl.command).toBe(20);
        });
    });

    describe('WebSocket events', () => {
        it('should handle mission current events', () => {
            mockHttpClient.post.mockResolvedValue({ current: 0, reached: 0, total: 5 });

            missionClient.requestMissionStatus().then(() => {
                mockWsClient.emit(EventType.MISSION_CURRENT, { seq: 3 });

                const status = missionClient.getCurrentMissionStatus();
                expect(status?.current).toBe(3);
            });
        });

        it('should handle mission item reached events', async () => {
            mockHttpClient.post.mockResolvedValue({ current: 0, reached: 0, total: 5 });

            await missionClient.requestMissionStatus();
            mockWsClient.emit(EventType.MISSION_ITEM_REACHED, { seq: 2 });

            const status = missionClient.getCurrentMissionStatus();
            expect(status?.reached).toBe(2);
        });
    });
});

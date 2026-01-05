import { TaskClient } from '../../src/tasks/TaskClient';
import { HttpClient } from '../../src/core/HttpClient';
import { WebSocketClient } from '../../src/core/WebSocketClient';
import {
    Task,
    TaskCreateRequest,
    TaskUpdateRequest,
    TaskListResponse,
    TaskExecutionResponse,
    TaskExecutionStatus,
    TaskType,
    TaskStatus,
    TaskPriority
} from '../../src/tasks/TaskTypes';

class MockHttpClient {
    get = jest.fn();
    post = jest.fn();
    put = jest.fn();
    delete = jest.fn();
}

class MockWebSocketClient {
    on = jest.fn();
}

describe('TaskClient', () => {
    let taskClient: TaskClient;
    let mockHttpClient: MockHttpClient;
    let mockWsClient: MockWebSocketClient;

    beforeEach(() => {
        mockHttpClient = new MockHttpClient();
        mockWsClient = new MockWebSocketClient();
        taskClient = new TaskClient(
            mockHttpClient as any,
            mockWsClient as any
        );
        jest.clearAllMocks();
    });

    describe('createTask', () => {
        it('should create a new task', async () => {
            const request: TaskCreateRequest = {
                name: 'Mowing Task',
                description: 'Mow the lawn',
                type: TaskType.MOWING,
                priority: TaskPriority.NORMAL,
                waypoints: []
            };
            const mockTask: Task = {
                metadata: {
                    id: '123',
                    name: 'Mowing Task',
                    description: 'Mow the lawn',
                    type: TaskType.MOWING,
                    status: TaskStatus.CREATED,
                    priority: TaskPriority.NORMAL,
                    createdTime: Date.now(),
                    modifiedTime: Date.now(),
                    version: 1
                },
                parameters: {},
                waypoints: []
            };
            mockHttpClient.post.mockResolvedValue(mockTask);

            const result = await taskClient.createTask(request);

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/tasks', request);
            expect(result).toEqual(mockTask);
        });
    });

    describe('getTask', () => {
        it('should retrieve a task by ID', async () => {
            const mockTask: Task = {
                metadata: {
                    id: '123',
                    name: 'Test Task',
                    description: 'Test',
                    type: TaskType.WAYPOINT_MISSION,
                    status: TaskStatus.CREATED,
                    priority: TaskPriority.NORMAL,
                    createdTime: Date.now(),
                    modifiedTime: Date.now(),
                    version: 1
                },
                parameters: {},
                waypoints: []
            };
            mockHttpClient.get.mockResolvedValue(mockTask);

            const result = await taskClient.getTask('123');

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/tasks/123');
            expect(result).toEqual(mockTask);
        });
    });

    describe('updateTask', () => {
        it('should update a task', async () => {
            const request: TaskUpdateRequest = {
                name: 'Updated Task Name',
                priority: TaskPriority.HIGH
            };
            const mockTask: Task = {
                metadata: {
                    id: '123',
                    name: 'Updated Task Name',
                    description: 'Test',
                    type: TaskType.MOWING,
                    status: TaskStatus.CREATED,
                    priority: TaskPriority.HIGH,
                    createdTime: Date.now(),
                    modifiedTime: Date.now(),
                    version: 1
                },
                parameters: {},
                waypoints: []
            };
            mockHttpClient.put.mockResolvedValue(mockTask);

            const result = await taskClient.updateTask('123', request);

            expect(mockHttpClient.put).toHaveBeenCalledWith('/api/tasks/123', request);
            expect(result).toEqual(mockTask);
        });
    });

    describe('deleteTask', () => {
        it('should delete a task', async () => {
            mockHttpClient.delete.mockResolvedValue(undefined);

            await taskClient.deleteTask('123');

            expect(mockHttpClient.delete).toHaveBeenCalledWith('/api/tasks/123');
        });
    });

    describe('listTasks', () => {
        it('should list all tasks without filters', async () => {
            const mockResponse: TaskListResponse = {
                tasks: [],
                totalCount: 0
            };
            mockHttpClient.get.mockResolvedValue(mockResponse);

            const result = await taskClient.listTasks();

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/tasks');
            expect(result).toEqual(mockResponse);
        });

        it('should list tasks with filters', async () => {
            mockHttpClient.get.mockResolvedValue({ tasks: [], totalCount: 0 });

            await taskClient.listTasks({
                type: TaskType.MOWING,
                status: TaskStatus.EXECUTING,
                priority: TaskPriority.HIGH
            });

            expect(mockHttpClient.get).toHaveBeenCalledWith(
                '/api/tasks?type=mowing&status=executing&priority=high'
            );
        });
    });

    describe('Task execution', () => {
        describe('executeTask', () => {
            it('should execute a task', async () => {
                const mockResponse: TaskExecutionResponse = {
                    success: true,
                    taskId: '123',
                    operation: 'execute',
                    executionId: 'exec-456'
                };
                mockHttpClient.post.mockResolvedValue(mockResponse);

                const result = await taskClient.executeTask('123');

                expect(mockHttpClient.post).toHaveBeenCalledWith(
                    '/api/tasks/123/execute',
                    {}
                );
                expect(result).toEqual(mockResponse);
            });

            it('should prevent concurrent execution of same task', async () => {
                mockHttpClient.post.mockImplementation(
                    () => new Promise(resolve => setTimeout(() => resolve({ status: 'started' }), 100))
                );

                const promise1 = taskClient.executeTask('123');
                const promise2 = taskClient.executeTask('123');

                await expect(promise2).rejects.toThrow('Task 123 operation already in progress');
                await promise1;
            });
        });

        describe('cancelTask', () => {
            it('should cancel a task', async () => {
                mockHttpClient.post.mockResolvedValue({ status: 'cancelled' });

                await taskClient.cancelTask('123');

                expect(mockHttpClient.post).toHaveBeenCalledWith('/api/tasks/123/cancel');
            });
        });

        describe('pauseTask', () => {
            it('should pause a task', async () => {
                mockHttpClient.post.mockResolvedValue({ status: 'paused' });

                await taskClient.pauseTask('123');

                expect(mockHttpClient.post).toHaveBeenCalledWith('/api/tasks/123/pause');
            });
        });

        describe('resumeTask', () => {
            it('should resume a task', async () => {
                mockHttpClient.post.mockResolvedValue({ status: 'resumed' });

                await taskClient.resumeTask('123');

                expect(mockHttpClient.post).toHaveBeenCalledWith('/api/tasks/123/resume');
            });
        });

        describe('getTaskExecutionStatus', () => {
            it('should get task execution status', async () => {
                const mockStatus: TaskExecutionStatus = {
                    taskId: '123',
                    status: TaskStatus.EXECUTING,
                    progress: 45,
                    currentWaypointIndex: 3,
                    totalWaypoints: 10
                };
                mockHttpClient.get.mockResolvedValue(mockStatus);

                const result = await taskClient.getTaskExecutionStatus('123');

                expect(mockHttpClient.get).toHaveBeenCalledWith('/api/tasks/123/status');
                expect(result).toEqual(mockStatus);
            });
        });
    });

    describe('Import/Export', () => {
        describe('importTasks', () => {
            it('should import tasks', async () => {
                const request = {
                    data: '{"tasks": []}',
                    format: 'json' as any
                };
                mockHttpClient.post.mockResolvedValue({ imported: 0, failed: 0 });

                await taskClient.importTasks(request);

                expect(mockHttpClient.post).toHaveBeenCalledWith('/api/tasks/import', request);
            });
        });

        describe('exportTasks', () => {
            it('should export all tasks', async () => {
                mockHttpClient.get.mockResolvedValue({ data: '{}', format: 'json' });

                await taskClient.exportTasks();

                expect(mockHttpClient.get).toHaveBeenCalledWith('/api/tasks/export');
            });

            it('should export specific tasks', async () => {
                mockHttpClient.post.mockResolvedValue({ data: '{}', format: 'json' });

                await taskClient.exportTasks({ taskIds: ['123', '456'] });

                expect(mockHttpClient.post).toHaveBeenCalledWith(
                    '/api/tasks/export',
                    expect.objectContaining({ taskIds: ['123', '456'] })
                );
            });
        });

        describe('exportAllTasks', () => {
            it('should export all tasks with default format', async () => {
                mockHttpClient.get.mockResolvedValue({ data: '{}' });

                await taskClient.exportAllTasks();

                expect(mockHttpClient.get).toHaveBeenCalled();
            });
        });

        describe('exportSpecificTasks', () => {
            it('should export specific tasks', async () => {
                mockHttpClient.post.mockResolvedValue({ data: '{}' });

                await taskClient.exportSpecificTasks(['123', '456']);

                expect(mockHttpClient.post).toHaveBeenCalled();
            });
        });
    });

    describe('Templates', () => {
        describe('getTaskTemplates', () => {
            it('should retrieve task templates', async () => {
                mockHttpClient.get.mockResolvedValue({ templates: [] });

                await taskClient.getTaskTemplates();

                expect(mockHttpClient.get).toHaveBeenCalledWith('/api/tasks/templates');
            });
        });

        describe('createTaskFromTemplate', () => {
            it('should create task from template', async () => {
                const request = {
                    templateId: 'template-1',
                    name: 'New Task'
                };
                mockHttpClient.post.mockResolvedValue({ id: '123' });

                await taskClient.createTaskFromTemplate(request);

                expect(mockHttpClient.post).toHaveBeenCalledWith('/api/tasks/templates', request);
            });
        });
    });

    describe('Convenience methods', () => {
        describe('createWaypointTask', () => {
            it('should create waypoint task request', () => {
                const waypoints = [
                    { latitude: 37.7749, longitude: -122.4194, altitude: 50 }
                ];

                const request = taskClient.createWaypointTask('Test', waypoints, 'Description');

                expect(request.name).toBe('Test');
                expect(request.type).toBe(TaskType.WAYPOINT_MISSION);
                expect(request.waypoints).toEqual(waypoints);
            });
        });

        describe('createMowingTask', () => {
            it('should create mowing task with pattern', () => {
                const pattern = {
                    centerLat: 37.7749,
                    centerLng: -122.4194,
                    width: 50,
                    height: 30,
                    spacing: 2,
                    altitude: 5,
                    speed: 2.0
                };

                const request = taskClient.createMowingTask('Mow Lawn', pattern);

                expect(request.name).toBe('Mow Lawn');
                expect(request.type).toBe(TaskType.MOWING);
                expect(request.waypoints).toBeDefined();
                expect(request.waypoints!.length).toBeGreaterThan(0);
            });
        });

        describe('createSurveyTask', () => {
            it('should create survey task with pattern', () => {
                const pattern = {
                    centerLat: 37.7749,
                    centerLng: -122.4194,
                    width: 100,
                    height: 80,
                    spacing: 10,
                    altitude: 50,
                    backAndForth: true
                };

                const request = taskClient.createSurveyTask('Survey Area', pattern);

                expect(request.name).toBe('Survey Area');
                expect(request.type).toBe(TaskType.SURVEYING);
                expect(request.waypoints).toBeDefined();
                expect(request.waypoints!.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Pattern generation', () => {
        describe('generateMowingPattern', () => {
            it('should generate mowing pattern waypoints', () => {
                const waypoints = taskClient.generateMowingPattern({
                    centerLat: 37.7749,
                    centerLng: -122.4194,
                    width: 50,
                    height: 30,
                    spacing: 2,
                    altitude: 5
                });

                expect(waypoints.length).toBeGreaterThan(0);
                expect(waypoints.length % 2).toBe(0); // Should be even (back and forth)
            });
        });

        describe('generateSurveyPattern', () => {
            it('should generate survey pattern waypoints', () => {
                const waypoints = taskClient.generateSurveyPattern({
                    centerLat: 37.7749,
                    centerLng: -122.4194,
                    width: 100,
                    height: 80,
                    spacing: 10,
                    altitude: 50,
                    backAndForth: true
                });

                expect(waypoints.length).toBeGreaterThan(0);
            });
        });

        describe('generateSpiralPattern', () => {
            it('should generate spiral pattern waypoints', () => {
                const waypoints = taskClient.generateSpiralPattern({
                    centerLat: 37.7749,
                    centerLng: -122.4194,
                    radius: 50,
                    spacing: 5,
                    altitude: 10,
                    clockwise: true
                });

                expect(waypoints.length).toBeGreaterThan(0);
            });
        });

        describe('generatePerimeterPattern', () => {
            it('should generate perimeter pattern waypoints', () => {
                const waypoints = taskClient.generatePerimeterPattern({
                    centerLat: 37.7749,
                    centerLng: -122.4194,
                    width: 50,
                    height: 30,
                    altitude: 5,
                    buffer: 2
                });

                expect(waypoints.length).toBe(5); // 4 corners + return to start
            });
        });
    });

    describe('Error handling', () => {
        it('should handle createTask errors', async () => {
            mockHttpClient.post.mockRejectedValue(new Error('Creation failed'));

            await expect(
                taskClient.createTask({ name: 'Test', type: TaskType.MOWING } as any)
            ).rejects.toThrow('Creation failed');
        });

        it('should handle getTask errors', async () => {
            mockHttpClient.get.mockRejectedValue(new Error('Not found'));

            await expect(taskClient.getTask('999')).rejects.toThrow('Not found');
        });
    });
});

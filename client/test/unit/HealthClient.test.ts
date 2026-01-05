import { HealthClient } from '../../src/health/HealthClient';
import { HttpClient } from '../../src/core/HttpClient';
import { WebSocketClient } from '../../src/core/WebSocketClient';
import {
    SystemHealth,
    MemoryStats,
    TaskStats,
    ErrorInfo,
    SystemMetrics,
    HealthThresholds,
    HealthCheckResponse
} from '../../src/health/HealthTypes';

class MockHttpClient {
    get = jest.fn();
    post = jest.fn();
    delete = jest.fn();
    getBaseUrl = jest.fn(() => 'http://test');
}

class MockWebSocketClient {
    on = jest.fn();
    connect = jest.fn();
    disconnect = jest.fn();
}

describe('HealthClient', () => {
    let healthClient: HealthClient;
    let mockHttpClient: MockHttpClient;
    let mockWsClient: MockWebSocketClient;

    beforeEach(() => {
        mockHttpClient = new MockHttpClient();
        mockWsClient = new MockWebSocketClient();
        healthClient = new HealthClient(
            mockHttpClient as any,
            mockWsClient as any
        );
        jest.clearAllMocks();
    });

    describe('getHealthCheck', () => {
        it('should retrieve health check information', async () => {
            const mockHealthCheck: HealthCheckResponse = {
                status: 'healthy',
                uptime: 3600000,
                freeHeap: 100000,
                device: {} as any,
                network: {} as any,
                config: { version: 1, isDirty: false },
                storage: { freeBytes: 1000000, totalBytes: 4000000, usedBytes: 3000000, healthy: true }
            };
            mockHttpClient.get.mockResolvedValue(mockHealthCheck);

            const result = await healthClient.getHealthCheck();

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/health');
            expect(result).toEqual(mockHealthCheck);
        });
    });

    describe('getSystemHealth', () => {
        it('should retrieve system health information', async () => {
            const mockHealth: SystemHealth = {
                cpuUsage: 45.5,
                temperature: 55.2,
                uptime: 3600000,
                freeHeap: 100000,
                minFreeHeap: 80000,
                largestFreeBlock: 50000,
                lowMemoryWarning: false,
                systemHealthy: true,
                tasks: [],
                components: []
            };
            mockHttpClient.get.mockResolvedValue(mockHealth);

            const result = await healthClient.getSystemHealth();

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/health/system');
            expect(result).toEqual(mockHealth);
        });
    });

    describe('getMemoryStats', () => {
        it('should retrieve memory statistics', async () => {
            const mockMemory: MemoryStats = {
                totalHeap: 320000,
                freeHeap: 180000,
                minFreeHeap: 150000,
                largestFreeBlock: 100000,
                allocations: 0,
                frees: 0,
                fragmentation: 15.5,
                poolAllocations: 0,
                poolFrees: 0,
                poolHits: 0,
                poolMisses: 0
            };
            mockHttpClient.get.mockResolvedValue(mockMemory);

            const result = await healthClient.getMemoryStats();

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/health/memory');
            expect(result).toEqual(mockMemory);
        });
    });

    describe('getTaskStats', () => {
        it('should retrieve task statistics', async () => {
            const mockTasks: TaskStats[] = [
                {
                    name: 'IDLE',
                    state: 'Running',
                    priority: 0,
                    stackHighWaterMark: 200,
                    runtime: 1000000,
                    watchdogFeeds: 100,
                    watchdogViolations: 0,
                    healthy: true
                },
                {
                    name: 'main',
                    state: 'Ready',
                    priority: 1,
                    stackHighWaterMark: 1500,
                    runtime: 500000,
                    watchdogFeeds: 50,
                    watchdogViolations: 0,
                    healthy: true
                }
            ];
            mockHttpClient.get.mockResolvedValue(mockTasks);

            const result = await healthClient.getTaskStats();

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/health/tasks');
            expect(result).toEqual(mockTasks);
        });
    });

    describe('getErrors', () => {
        it('should retrieve recent errors with default count', async () => {
            const mockErrors: ErrorInfo[] = [
                {
                    level: 'ERROR',
                    component: 'wifi',
                    message: 'Connection failed',
                    timestamp: Date.now(),
                    code: 100,
                    count: 1
                }
            ];
            mockHttpClient.get.mockResolvedValue(mockErrors);

            const result = await healthClient.getErrors();

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/health/errors?count=10');
            expect(result).toEqual(mockErrors);
        });

        it('should retrieve errors with custom count', async () => {
            const mockErrors: ErrorInfo[] = [];
            mockHttpClient.get.mockResolvedValue(mockErrors);

            await healthClient.getErrors(25);

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/health/errors?count=25');
        });
    });

    describe('getErrorsByComponent', () => {
        it('should retrieve errors filtered by component', async () => {
            const mockErrors: ErrorInfo[] = [
                {
                    level: 'WARNING',
                    component: 'rtcm',
                    message: 'Connection timeout',
                    timestamp: Date.now(),
                    code: 200,
                    count: 1
                }
            ];
            mockHttpClient.get.mockResolvedValue(mockErrors);

            const result = await healthClient.getErrorsByComponent('rtcm');

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/health/errors/component/rtcm');
            expect(result).toEqual(mockErrors);
        });
    });

    describe('getErrorsByLevel', () => {
        it('should retrieve errors filtered by level', async () => {
            const mockErrors: ErrorInfo[] = [];
            mockHttpClient.get.mockResolvedValue(mockErrors);

            await healthClient.getErrorsByLevel('CRITICAL');

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/health/errors/level/CRITICAL');
        });
    });

    describe('getSystemMetrics', () => {
        it('should retrieve comprehensive system metrics', async () => {
            const mockHealth: SystemHealth = {
                uptime: 3600000,
                freeHeap: 100000,
                minFreeHeap: 80000,
                largestFreeBlock: 50000,
                cpuUsage: 40,
                temperature: 50,
                lowMemoryWarning: false,
                systemHealthy: true,
                tasks: [],
                components: []
            };
            const mockMemory: MemoryStats = {
                totalHeap: 320000,
                freeHeap: 180000,
                minFreeHeap: 150000,
                largestFreeBlock: 100000,
                allocations: 0,
                frees: 0,
                fragmentation: 15.5,
                poolAllocations: 0,
                poolFrees: 0,
                poolHits: 0,
                poolMisses: 0
            };
            const mockTasks: TaskStats[] = [];
            const mockErrors: ErrorInfo[] = [];

            mockHttpClient.get
                .mockResolvedValueOnce(mockHealth)
                .mockResolvedValueOnce(mockMemory)
                .mockResolvedValueOnce(mockTasks)
                .mockResolvedValueOnce(mockErrors);

            const result = await healthClient.getSystemMetrics();

            expect(result.health).toEqual(mockHealth);
            expect(result.memory).toEqual(mockMemory);
            expect(result.tasks).toEqual(mockTasks);
            expect(result.errors).toEqual(mockErrors);
            expect(result.lastUpdate).toBeGreaterThan(0);
        });

        it('should use cached metrics when available and not expired', async () => {
            const mockHealth: SystemHealth = {
                cpuUsage: 40,
                temperature: 50,
                uptime: 3600000,
                freeHeap: 100000,
                minFreeHeap: 80000,
                largestFreeBlock: 50000,
                lowMemoryWarning: false,
                systemHealthy: true,
                tasks: [],
                components: []
            };

            mockHttpClient.get
                .mockResolvedValueOnce(mockHealth)
                .mockResolvedValueOnce({} as MemoryStats)
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);

            // First call populates cache
            const result1 = await healthClient.getSystemMetrics();
            expect(mockHttpClient.get).toHaveBeenCalledTimes(4);

            mockHttpClient.get.mockClear();

            // Second call should use cache
            const result2 = await healthClient.getSystemMetrics(true);
            expect(mockHttpClient.get).not.toHaveBeenCalled();
            expect(result1).toEqual(result2);
        });

        it('should bypass cache when requested', async () => {
            mockHttpClient.get
                .mockResolvedValueOnce({} as SystemHealth)
                .mockResolvedValueOnce({} as MemoryStats)
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);

            await healthClient.getSystemMetrics();

            mockHttpClient.get.mockClear();
            mockHttpClient.get
                .mockResolvedValueOnce({} as SystemHealth)
                .mockResolvedValueOnce({} as MemoryStats)
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);

            await healthClient.getSystemMetrics(false);

            expect(mockHttpClient.get).toHaveBeenCalledTimes(4);
        });
    });

    describe('setThresholds', () => {
        it('should set health monitoring thresholds', async () => {
            const thresholds: HealthThresholds = {
                cpuThreshold: 80,
                temperatureThreshold: 85,
                memoryThreshold: 50000
            };
            mockHttpClient.post.mockResolvedValue(undefined);

            await healthClient.setThresholds(thresholds);

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/health/thresholds', thresholds);
        });
    });

    describe('getThresholds', () => {
        it('should retrieve current health thresholds', async () => {
            const mockThresholds: HealthThresholds = {
                cpuThreshold: 80,
                temperatureThreshold: 85,
                memoryThreshold: 50000
            };
            mockHttpClient.get.mockResolvedValue(mockThresholds);

            const result = await healthClient.getThresholds();

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/health/thresholds');
            expect(result).toEqual(mockThresholds);
        });
    });

    describe('triggerHealthCheck', () => {
        it('should trigger manual health check and invalidate cache', async () => {
            mockHttpClient.post.mockResolvedValue(undefined);

            // Populate cache first
            mockHttpClient.get
                .mockResolvedValueOnce({} as SystemHealth)
                .mockResolvedValueOnce({} as MemoryStats)
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);
            await healthClient.getSystemMetrics();

            mockHttpClient.get.mockClear();

            // Trigger health check
            await healthClient.triggerHealthCheck();

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/health/check');

            // Cache should be invalidated
            mockHttpClient.get
                .mockResolvedValueOnce({} as SystemHealth)
                .mockResolvedValueOnce({} as MemoryStats)
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);
            await healthClient.getSystemMetrics(true);
            expect(mockHttpClient.get).toHaveBeenCalledTimes(4);
        });
    });

    describe('clearErrors', () => {
        it('should clear all errors', async () => {
            mockHttpClient.delete.mockResolvedValue(undefined);

            await healthClient.clearErrors();

            expect(mockHttpClient.delete).toHaveBeenCalledWith('/api/health/errors');
        });
    });

    describe('clearOldErrors', () => {
        it('should clear errors older than specified age', async () => {
            mockHttpClient.delete.mockResolvedValue(undefined);

            await healthClient.clearOldErrors(86400000); // 24 hours

            expect(mockHttpClient.delete).toHaveBeenCalledWith('/api/health/errors?older_than=86400000');
        });
    });

    describe('getErrorSummary', () => {
        it('should retrieve error statistics summary', async () => {
            const mockSummary = {
                total: 50,
                byLevel: { ERROR: 10, WARNING: 30, INFO: 10 },
                recent: 5,
                timeSinceLastError: 60000
            };
            mockHttpClient.get.mockResolvedValue(mockSummary);

            const result = await healthClient.getErrorSummary();

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/health/errors/summary');
            expect(result).toEqual(mockSummary);
        });
    });

    describe('testMemoryAllocation', () => {
        it('should test memory allocation', async () => {
            const mockResponse = {
                success: true,
                allocated: 10000,
                freeHeapBefore: 100000,
                freeHeapAfter: 90000
            };
            mockHttpClient.post.mockResolvedValue(mockResponse);

            const result = await healthClient.testMemoryAllocation(10000);

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/health/memory/test', { size: 10000 });
            expect(result).toEqual(mockResponse);
        });
    });

    describe('emergencyMemoryCleanup', () => {
        it('should trigger emergency memory cleanup', async () => {
            const mockResponse = {
                freedBytes: 5000,
                beforeFree: 80000,
                afterFree: 85000
            };
            mockHttpClient.post.mockResolvedValue(mockResponse);

            const result = await healthClient.emergencyMemoryCleanup();

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/health/memory/cleanup');
            expect(result).toEqual(mockResponse);
        });
    });

    describe('defragmentMemory', () => {
        it('should defragment heap memory', async () => {
            const mockResponse = {
                beforeFree: 80000,
                afterFree: 85000,
                beforeLargest: 40000,
                afterLargest: 50000,
                fragmentation: 12.5
            };
            mockHttpClient.post.mockResolvedValue(mockResponse);

            const result = await healthClient.defragmentMemory();

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/health/memory/defragment');
            expect(result).toEqual(mockResponse);
        });
    });

    describe('Error handling', () => {
        it('should handle network errors in getSystemHealth', async () => {
            mockHttpClient.get.mockRejectedValue(new Error('Network error'));

            await expect(healthClient.getSystemHealth()).rejects.toThrow('Network error');
        });

        it('should handle errors in getSystemMetrics', async () => {
            mockHttpClient.get.mockRejectedValue(new Error('API error'));

            await expect(healthClient.getSystemMetrics()).rejects.toThrow();
        });
    });
});

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { machineService } from '@/services';
import type { Task, TaskProgress, ApiState } from './types';

export const useTasksStore = defineStore('tasks', () => {
    // State
    const tasks = ref<Task[]>([]);
    const taskQueue = ref<Task[]>([]);
    const completedTasks = ref<Task[]>([]);
    const currentTaskProgress = ref<Map<string, TaskProgress>>(new Map());
    const apiState = ref<ApiState>({
        loading: 'idle',
        error: null,
        lastUpdated: null,
    });

    // Getters
    const pendingTasks = computed(() =>
        tasks.value.filter(task => task.status === 'pending')
    );

    const runningTasks = computed(() =>
        tasks.value.filter(task => task.status === 'running')
    );

    const pausedTasks = computed(() =>
        tasks.value.filter(task => task.status === 'paused')
    );

    const failedTasks = computed(() =>
        tasks.value.filter(task => task.status === 'failed')
    );

    const highPriorityTasks = computed(() =>
        tasks.value.filter(task => task.priority === 'high' || task.priority === 'urgent')
    );

    const totalTasks = computed(() => tasks.value.length);

    const completedTasksCount = computed(() =>
        tasks.value.filter(task => task.status === 'completed').length
    );

    const successRate = computed(() => {
        const total = completedTasksCount.value + failedTasks.value.length;
        return total > 0 ? Math.round((completedTasksCount.value / total) * 100) : 0;
    });

    const nextTask = computed(() => {
        const pending = pendingTasks.value.sort((a, b) => {
            // Sort by priority first, then by scheduled time
            const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
            const aPriority = priorityOrder[a.priority];
            const bPriority = priorityOrder[b.priority];

            if (aPriority !== bPriority) {
                return bPriority - aPriority;
            }

            if (a.scheduledAt && b.scheduledAt) {
                return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
            }

            return 0;
        });

        return pending.length > 0 ? pending[0] : null;
    });

    const isLoading = computed(() => apiState.value.loading === 'loading');
    const hasError = computed(() => apiState.value.error !== null);

    // Actions
    const setLoading = (loading: boolean) => {
        apiState.value.loading = loading ? 'loading' : 'idle';
    };

    const setError = (error: string | null) => {
        apiState.value.error = error;
        if (error) {
            apiState.value.loading = 'error';
        }
    };

    const clearError = () => {
        apiState.value.error = null;
    };

    const addTask = (task: Task) => {
        const existingIndex = tasks.value.findIndex(t => t.id === task.id);
        if (existingIndex >= 0) {
            tasks.value[existingIndex] = task;
        } else {
            tasks.value.push(task);
        }
        apiState.value.lastUpdated = new Date().toISOString();
    };

    const updateTask = (taskId: string, updates: Partial<Task>) => {
        const taskIndex = tasks.value.findIndex(t => t.id === taskId);
        if (taskIndex >= 0) {
            tasks.value[taskIndex] = { ...tasks.value[taskIndex], ...updates };
            apiState.value.lastUpdated = new Date().toISOString();
        }
    };

    const removeTask = (taskId: string) => {
        const taskIndex = tasks.value.findIndex(t => t.id === taskId);
        if (taskIndex >= 0) {
            tasks.value.splice(taskIndex, 1);
            currentTaskProgress.value.delete(taskId);
            apiState.value.lastUpdated = new Date().toISOString();
        }
    };

    const updateTaskProgress = (taskId: string, progress: TaskProgress) => {
        currentTaskProgress.value.set(taskId, progress);

        // Update task progress percentage
        const task = tasks.value.find(t => t.id === taskId);
        if (task) {
            task.progress = progress.progress;
        }
    };

    const fetchTasks = async (machineId?: string, status?: string) => {
        try {
            setLoading(true);
            clearError();

            let allTasks: any[] = [];

            if (machineId) {
                allTasks = await machineService.getTasks(machineId, status);
            } else {
                // Fetch tasks for all machines (if we have multiple)
                // This would require a different API endpoint or multiple calls
                // For now, assume we need a machine ID
                throw new Error('Machine ID is required to fetch tasks');
            }

            // Clear existing tasks if no status filter
            if (!status) {
                tasks.value = [];
            }

            // Add or update tasks
            allTasks.forEach(task => addTask(task));

            apiState.value.loading = 'success';
            return allTasks;
        } catch (error: any) {
            setError(error.message || 'Failed to fetch tasks');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const createTask = async (machineId: string, taskData: Omit<Task, 'id' | 'status' | 'createdBy' | 'machineId' | 'progress'>) => {
        try {
            setLoading(true);
            clearError();

            const newTask = await machineService.createTask(machineId, taskData);
            addTask(newTask);

            apiState.value.loading = 'success';
            return newTask;
        } catch (error: any) {
            setError(error.message || 'Failed to create task');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const updateTaskById = async (taskId: string, updates: Partial<Task>) => {
        try {
            setLoading(true);
            clearError();

            const updatedTask = await machineService.updateTask(taskId, updates);
            addTask(updatedTask);

            apiState.value.loading = 'success';
            return updatedTask;
        } catch (error: any) {
            setError(error.message || 'Failed to update task');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const deleteTask = async (taskId: string) => {
        try {
            setLoading(true);
            clearError();

            await machineService.deleteTask(taskId);
            removeTask(taskId);

            apiState.value.loading = 'success';
        } catch (error: any) {
            setError(error.message || 'Failed to delete task');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const executeTask = async (taskId: string) => {
        try {
            setLoading(true);
            clearError();

            await machineService.executeTask(taskId);

            // Update task status to running
            updateTask(taskId, {
                status: 'running',
                startedAt: new Date().toISOString(),
            });

            apiState.value.loading = 'success';
        } catch (error: any) {
            setError(error.message || 'Failed to execute task');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const pauseTask = async (taskId: string) => {
        try {
            setLoading(true);
            clearError();

            // This would need a pause endpoint in the API
            // For now, just update local state
            updateTask(taskId, { status: 'paused' });

            apiState.value.loading = 'success';
        } catch (error: any) {
            setError(error.message || 'Failed to pause task');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const resumeTask = async (taskId: string) => {
        try {
            setLoading(true);
            clearError();

            // This would need a resume endpoint in the API
            // For now, just update local state
            updateTask(taskId, { status: 'running' });

            apiState.value.loading = 'success';
        } catch (error: any) {
            setError(error.message || 'Failed to resume task');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const cancelTask = async (taskId: string) => {
        try {
            setLoading(true);
            clearError();

            // This would need a cancel endpoint in the API
            // For now, just update local state
            updateTask(taskId, {
                status: 'cancelled',
                completedAt: new Date().toISOString(),
            });

            apiState.value.loading = 'success';
        } catch (error: any) {
            setError(error.message || 'Failed to cancel task');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const retryTask = async (taskId: string) => {
        try {
            setLoading(true);
            clearError();

            // Reset task status and execute again
            updateTask(taskId, {
                status: 'pending',
                progress: 0,
                startedAt: undefined,
                completedAt: undefined,
            });

            await executeTask(taskId);

            apiState.value.loading = 'success';
        } catch (error: any) {
            setError(error.message || 'Failed to retry task');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const getTaskProgress = (taskId: string): TaskProgress | null => {
        return currentTaskProgress.value.get(taskId) || null;
    };

    const getTasksByStatus = (status: Task['status']): Task[] => {
        return tasks.value.filter(task => task.status === status);
    };

    const getTasksByPriority = (priority: Task['priority']): Task[] => {
        return tasks.value.filter(task => task.priority === priority);
    };

    const getTasksByType = (type: Task['type']): Task[] => {
        return tasks.value.filter(task => task.type === type);
    };

    const getUpcomingTasks = (hours = 24): Task[] => {
        const now = new Date();
        const future = new Date(now.getTime() + hours * 60 * 60 * 1000);

        return tasks.value.filter(task => {
            if (!task.scheduledAt) return false;
            const scheduledTime = new Date(task.scheduledAt);
            return scheduledTime >= now && scheduledTime <= future;
        }).sort((a, b) => {
            const aTime = new Date(a.scheduledAt!).getTime();
            const bTime = new Date(b.scheduledAt!).getTime();
            return aTime - bTime;
        });
    };

    const getTaskStats = () => {
        const total = tasks.value.length;
        const completed = tasks.value.filter(t => t.status === 'completed').length;
        const failed = tasks.value.filter(t => t.status === 'failed').length;
        const running = tasks.value.filter(t => t.status === 'running').length;
        const pending = tasks.value.filter(t => t.status === 'pending').length;

        return {
            total,
            completed,
            failed,
            running,
            pending,
            successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        };
    };

    // WebSocket handlers for real-time updates
    const handleWebSocketUpdate = (eventType: string, data: any) => {
        switch (eventType) {
            case 'task.progress':
                if (data.taskId) {
                    updateTaskProgress(data.taskId, data);
                }
                break;

            case 'task.status':
                if (data.taskId) {
                    updateTask(data.taskId, {
                        status: data.status,
                        progress: data.progress || 0,
                        ...(data.status === 'completed' && { completedAt: new Date().toISOString() }),
                        ...(data.status === 'failed' && { completedAt: new Date().toISOString() }),
                    });
                }
                break;

            case 'task.created':
                if (data.task) {
                    addTask(data.task);
                }
                break;

            case 'task.deleted':
                if (data.taskId) {
                    removeTask(data.taskId);
                }
                break;
        }
    };

    // Reset store state
    const $reset = () => {
        tasks.value = [];
        taskQueue.value = [];
        completedTasks.value = [];
        currentTaskProgress.value.clear();
        apiState.value = {
            loading: 'idle',
            error: null,
            lastUpdated: null,
        };
    };

    return {
        // State
        tasks: computed(() => tasks.value),
        taskQueue: computed(() => taskQueue.value),
        completedTasks: computed(() => completedTasks.value),
        currentTaskProgress: computed(() => currentTaskProgress.value),
        apiState: computed(() => apiState.value),

        // Getters
        pendingTasks,
        runningTasks,
        pausedTasks,
        failedTasks,
        highPriorityTasks,
        totalTasks,
        completedTasksCount,
        successRate,
        nextTask,
        isLoading,
        hasError,

        // Actions
        fetchTasks,
        createTask,
        updateTaskById,
        deleteTask,
        executeTask,
        pauseTask,
        resumeTask,
        cancelTask,
        retryTask,
        getTaskProgress,
        getTasksByStatus,
        getTasksByPriority,
        getTasksByType,
        getUpcomingTasks,
        getTaskStats,
        handleWebSocketUpdate,
        clearError,
        $reset,
    };
});

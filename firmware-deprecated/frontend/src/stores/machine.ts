import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { machineService } from '@/services';
import type {
    MachineStatus,
    MachineError,
    ApiState,
    Task,
    TaskProgress,
    MachineLocation
} from './types';

export const useMachineStore = defineStore('machine', () => {
    // State
    const machines = ref<Map<string, MachineStatus>>(new Map());
    const activeMachineId = ref<string | null>(null);
    const apiState = ref<ApiState>({
        loading: 'idle',
        error: null,
        lastUpdated: null,
    });
    const currentTask = ref<Task | null>(null);
    const taskProgress = ref<TaskProgress | null>(null);
    const locationHistory = ref<Array<{
        machineId: string;
        location: MachineLocation;
        timestamp: string;
    }>>([]);

    // Getters
    const activeMachine = computed(() => {
        if (!activeMachineId.value) return null;
        return machines.value.get(activeMachineId.value) || null;
    });

    const machineList = computed(() => Array.from(machines.value.values()));

    const isOperational = computed(() => {
        const machine = activeMachine.value;
        return machine ? machine.status !== 'error' && machine.status !== 'maintenance' : false;
    });

    const batteryPercentage = computed(() => {
        const machine = activeMachine.value;
        return machine ? `${machine.batteryLevel}%` : '0%';
    });

    const isLowBattery = computed(() => {
        const machine = activeMachine.value;
        return machine ? machine.batteryLevel < 20 : false;
    });

    const isCriticalBattery = computed(() => {
        const machine = activeMachine.value;
        return machine ? machine.batteryLevel < 10 : false;
    });

    const currentMode = computed(() => activeMachine.value?.mode || 'manual');

    const machineErrors = computed(() => {
        const machine = activeMachine.value;
        return machine ? machine.errors.filter(error => !error.resolved) : [];
    });

    const hasCriticalErrors = computed(() => {
        return machineErrors.value.some(error => error.severity === 'critical');
    });

    const isRunning = computed(() => {
        const machine = activeMachine.value;
        return machine ? machine.status === 'running' : false;
    });

    const isPaused = computed(() => {
        const machine = activeMachine.value;
        return machine ? machine.status === 'paused' : false;
    });

    const canStart = computed(() => {
        const machine = activeMachine.value;
        if (!machine) return false;
        return machine.status === 'idle' || machine.status === 'stopped' || machine.status === 'paused';
    });

    const canStop = computed(() => {
        const machine = activeMachine.value;
        if (!machine) return false;
        return machine.status === 'running' || machine.status === 'paused';
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

    const setActiveMachine = (machineId: string | null) => {
        activeMachineId.value = machineId;
    };

    const updateMachine = (machineData: MachineStatus) => {
        machines.value.set(machineData.id, machineData);
        apiState.value.lastUpdated = new Date().toISOString();

        // Add to location history
        locationHistory.value.push({
            machineId: machineData.id,
            location: machineData.location,
            timestamp: new Date().toISOString(),
        });

        // Keep only last 100 location points per machine
        locationHistory.value = locationHistory.value.slice(-100);
    };

    const fetchMachines = async () => {
        try {
            setLoading(true);
            clearError();

            const machineList = await machineService.getAllMachines();

            // Update machines map
            machines.value.clear();
            machineList.forEach(machine => {
                machines.value.set(machine.id, machine);
            });

            // Set first machine as active if none selected
            if (!activeMachineId.value && machineList.length > 0) {
                activeMachineId.value = machineList[0].id;
            }

            apiState.value.loading = 'success';
            return machineList;
        } catch (error: any) {
            setError(error.message || 'Failed to fetch machines');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const fetchMachineStatus = async (machineId?: string) => {
        const targetId = machineId || activeMachineId.value;
        if (!targetId) {
            throw new Error('No machine ID provided');
        }

        try {
            setLoading(true);
            clearError();

            const status = await machineService.getMachineStatus(targetId);
            updateMachine(status);

            apiState.value.loading = 'success';
            return status;
        } catch (error: any) {
            setError(error.message || 'Failed to fetch machine status');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const startMachine = async (machineId?: string, parameters?: Record<string, any>) => {
        const targetId = machineId || activeMachineId.value;
        if (!targetId) {
            throw new Error('No machine ID provided');
        }

        try {
            setLoading(true);
            clearError();

            await machineService.startMachine(targetId, parameters);

            // Refresh status after starting
            await fetchMachineStatus(targetId);

            apiState.value.loading = 'success';
        } catch (error: any) {
            setError(error.message || 'Failed to start machine');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const stopMachine = async (machineId?: string) => {
        const targetId = machineId || activeMachineId.value;
        if (!targetId) {
            throw new Error('No machine ID provided');
        }

        try {
            setLoading(true);
            clearError();

            await machineService.stopMachine(targetId);

            // Refresh status after stopping
            await fetchMachineStatus(targetId);

            apiState.value.loading = 'success';
        } catch (error: any) {
            setError(error.message || 'Failed to stop machine');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const pauseMachine = async (machineId?: string) => {
        const targetId = machineId || activeMachineId.value;
        if (!targetId) {
            throw new Error('No machine ID provided');
        }

        try {
            setLoading(true);
            clearError();

            await machineService.pauseMachine(targetId);

            // Refresh status after pausing
            await fetchMachineStatus(targetId);

            apiState.value.loading = 'success';
        } catch (error: any) {
            setError(error.message || 'Failed to pause machine');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const resumeMachine = async (machineId?: string) => {
        const targetId = machineId || activeMachineId.value;
        if (!targetId) {
            throw new Error('No machine ID provided');
        }

        try {
            setLoading(true);
            clearError();

            await machineService.resumeMachine(targetId);

            // Refresh status after resuming
            await fetchMachineStatus(targetId);

            apiState.value.loading = 'success';
        } catch (error: any) {
            setError(error.message || 'Failed to resume machine');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const emergencyStop = async (machineId?: string) => {
        const targetId = machineId || activeMachineId.value;
        if (!targetId) {
            throw new Error('No machine ID provided');
        }

        try {
            setLoading(true);
            clearError();

            await machineService.emergencyStop(targetId);

            // Refresh status after emergency stop
            await fetchMachineStatus(targetId);

            apiState.value.loading = 'success';
        } catch (error: any) {
            setError(error.message || 'Failed to emergency stop machine');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const returnHome = async (machineId?: string) => {
        const targetId = machineId || activeMachineId.value;
        if (!targetId) {
            throw new Error('No machine ID provided');
        }

        try {
            setLoading(true);
            clearError();

            await machineService.returnHome(targetId);

            // Refresh status after return home command
            await fetchMachineStatus(targetId);

            apiState.value.loading = 'success';
        } catch (error: any) {
            setError(error.message || 'Failed to send return home command');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const fetchCurrentTask = async (machineId?: string) => {
        const targetId = machineId || activeMachineId.value;
        if (!targetId) return null;

        try {
            const tasks = await machineService.getTasks(targetId, 'running');
            currentTask.value = tasks.length > 0 ? tasks[0] : null;
            return currentTask.value;
        } catch (error: any) {
            setError(error.message || 'Failed to fetch current task');
            return null;
        }
    };

    const fetchTaskProgress = async (taskId: string) => {
        try {
            const progress = await machineService.getTaskProgress(taskId);
            taskProgress.value = progress;
            return progress;
        } catch (error: any) {
            setError(error.message || 'Failed to fetch task progress');
            return null;
        }
    };

    const getLocationHistory = (machineId?: string, hours = 24) => {
        const targetId = machineId || activeMachineId.value;
        if (!targetId) return [];

        const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
        return locationHistory.value
            .filter(entry =>
                entry.machineId === targetId &&
                new Date(entry.timestamp) >= cutoff
            )
            .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    };

    const acknowledgeError = async (errorId: string) => {
        try {
            await machineService.acknowledgeAlert(errorId);

            // Update local error state
            const machine = activeMachine.value;
            if (machine) {
                const error = machine.errors.find(e => e.id === errorId);
                if (error) {
                    error.resolved = true;
                }
            }
        } catch (error: any) {
            setError(error.message || 'Failed to acknowledge error');
            throw error;
        }
    };

    // WebSocket handlers for real-time updates
    const handleWebSocketUpdate = (eventType: string, data: any) => {
        switch (eventType) {
            case 'machine.status':
                if (data.machineId && machines.value.has(data.machineId)) {
                    const machine = machines.value.get(data.machineId)!;
                    updateMachine({ ...machine, ...data });
                }
                break;

            case 'machine.location':
                if (data.machineId && machines.value.has(data.machineId)) {
                    const machine = machines.value.get(data.machineId)!;
                    updateMachine({
                        ...machine,
                        location: data.location,
                        speed: data.speed || machine.speed,
                        lastSeen: new Date().toISOString(),
                    });
                }
                break;

            case 'machine.battery':
                if (data.machineId && machines.value.has(data.machineId)) {
                    const machine = machines.value.get(data.machineId)!;
                    updateMachine({ ...machine, batteryLevel: data.level });
                }
                break;

            case 'task.progress':
                if (data.taskId === currentTask.value?.id) {
                    taskProgress.value = data;
                }
                break;

            case 'machine.error':
                if (data.machineId && machines.value.has(data.machineId)) {
                    const machine = machines.value.get(data.machineId)!;
                    const newError: MachineError = {
                        id: data.errorId,
                        code: data.code,
                        message: data.message,
                        severity: data.severity,
                        timestamp: new Date().toISOString(),
                        resolved: false,
                    };
                    machine.errors.push(newError);
                    updateMachine(machine);
                }
                break;
        }
    };

    // Reset store state
    const $reset = () => {
        machines.value.clear();
        activeMachineId.value = null;
        currentTask.value = null;
        taskProgress.value = null;
        locationHistory.value = [];
        apiState.value = {
            loading: 'idle',
            error: null,
            lastUpdated: null,
        };
    };

    return {
        // State
        machines: computed(() => machines.value),
        activeMachineId: computed(() => activeMachineId.value),
        apiState: computed(() => apiState.value),
        currentTask: computed(() => currentTask.value),
        taskProgress: computed(() => taskProgress.value),
        locationHistory: computed(() => locationHistory.value),

        // Getters
        activeMachine,
        machineList,
        isOperational,
        batteryPercentage,
        isLowBattery,
        isCriticalBattery,
        currentMode,
        machineErrors,
        hasCriticalErrors,
        isRunning,
        isPaused,
        canStart,
        canStop,
        isLoading,
        hasError,

        // Actions
        setActiveMachine,
        fetchMachines,
        fetchMachineStatus,
        startMachine,
        stopMachine,
        pauseMachine,
        resumeMachine,
        emergencyStop,
        returnHome,
        fetchCurrentTask,
        fetchTaskProgress,
        getLocationHistory,
        acknowledgeError,
        handleWebSocketUpdate,
        clearError,
        $reset,
    };
});

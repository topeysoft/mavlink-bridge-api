import { computed } from 'vue';
import { useAuthStore } from '../auth';
import { useMachineStore } from '../machine';
import { useTasksStore } from '../tasks';
import { useYardStore } from '../yard';
import { useSettingsStore } from '../settings';
import { useNotificationsStore } from '../notifications';
import { useWebSocketStore } from '../websocket';
import { useUIStore } from '../ui';

/**
 * Composable that provides access to all stores
 * Useful for components that need multiple stores
 */
export const useStores = () => {
    const auth = useAuthStore();
    const machine = useMachineStore();
    const tasks = useTasksStore();
    const yard = useYardStore();
    const settings = useSettingsStore();
    const notifications = useNotificationsStore();
    const websocket = useWebSocketStore();
    const ui = useUIStore();

    return {
        auth,
        machine,
        tasks,
        yard,
        settings,
        notifications,
        websocket,
        ui,
    };
};

/**
 * Composable for cross-store reactive computations
 * Provides combined state and derived values
 */
export const useStoreComputeds = () => {
    const stores = useStores();

    // Combined loading state across all stores
    const isAnyLoading = computed(() => {
        return stores.auth.isLoading ||
            stores.machine.isLoading ||
            stores.tasks.isLoading ||
            stores.yard.isLoading ||
            stores.settings.isLoading ||
            stores.ui.isAnyLoading;
    });

    // Combined error state
    const hasAnyError = computed(() => {
        return stores.auth.hasError ||
            stores.machine.hasError ||
            stores.tasks.hasError ||
            stores.yard.hasError ||
            stores.settings.hasError ||
            stores.notifications.hasError;
    });

    // Current machine with enhanced data
    const currentMachineWithTasks = computed(() => {
        const machine = stores.machine.currentMachine;
        if (!machine) return null;

        const allTasks = stores.tasks.tasks;
        const machineTasks = allTasks.filter(task => task.machineId === machine.id);
        const currentTask = machineTasks.find(task => task.status === 'running');

        return {
            ...machine,
            tasks: machineTasks,
            currentTask,
            taskCount: machineTasks.length,
            completedTasks: machineTasks.filter(t => t.status === 'completed').length,
            failedTasks: machineTasks.filter(t => t.status === 'failed').length,
        };
    });

    // Dashboard summary data
    const dashboardSummary = computed(() => {
        const onlineMachines = stores.machine.machines.filter(m =>
            m.status.status !== 'offline'
        );

        return {
            machinesOnline: onlineMachines.length,
            totalMachines: stores.machine.machines.length,
            activeTasks: stores.tasks.runningTasks.length,
            pendingTasks: stores.tasks.pendingTasks.length,
            unreadNotifications: stores.notifications.unreadCount,
            currentYard: stores.yard.currentYard?.name || 'No yard selected',
            connectionStatus: stores.websocket.connectionStatus,
            lastUpdate: new Date().toISOString(),
        };
    });

    // System health status
    const systemHealth = computed(() => {
        const errors = [];
        const warnings = [];

        // Check WebSocket connection
        if (!stores.websocket.isConnected) {
            warnings.push('Real-time connection offline');
        }

        // Check for machine errors
        stores.machine.machines.forEach(machine => {
            if (machine.status.status === 'error') {
                errors.push(`Machine ${machine.name} has errors`);
            }
        });

        // Check for failed tasks
        if (stores.tasks.failedTasks.length > 0) {
            warnings.push(`${stores.tasks.failedTasks.length} failed tasks`);
        }

        // Check authentication
        if (!stores.auth.isAuthenticated) {
            errors.push('User not authenticated');
        }

        const status = errors.length > 0 ? 'error' :
            warnings.length > 0 ? 'warning' : 'healthy';

        return {
            status,
            errors,
            warnings,
            score: Math.max(0, 100 - (errors.length * 20) - (warnings.length * 10)),
        };
    });

    // User activity status
    const userActivity = computed(() => {
        const user = stores.auth.user;
        if (!user) return null;

        const recentTasks = stores.tasks.tasks.filter(task => {
            if (!task.createdAt) return false;
            const taskDate = new Date(task.createdAt);
            const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            return taskDate > dayAgo;
        });

        return {
            user: user.name || user.email,
            role: user.role,
            lastLogin: user.lastLogin,
            recentTasksCount: recentTasks.length,
            notificationPreferences: user.preferences.notifications,
            theme: stores.settings.currentTheme,
        };
    });

    return {
        isAnyLoading,
        hasAnyError,
        currentMachineWithTasks,
        dashboardSummary,
        systemHealth,
        userActivity,
    };
};

/**
 * Composable for managing store subscriptions
 * Handles cleanup and prevents memory leaks
 */
export const useStoreSubscriptions = () => {
    const unsubscribers = new Set<() => void>();

    const subscribe = (store: any, callback: (mutation: any, state: any) => void) => {
        const unsubscribe = store.$subscribe(callback);
        unsubscribers.add(unsubscribe);
        return unsubscribe;
    };

    const subscribeToAuth = (callback: (user: any) => void) => {
        const auth = useAuthStore();
        return subscribe(auth, (mutation, state) => {
            if (mutation.type === 'direct' && mutation.events.target === state.user) {
                callback(state.user);
            }
        });
    };

    const subscribeToMachines = (callback: (machines: any[]) => void) => {
        const machine = useMachineStore();
        return subscribe(machine, (mutation, state) => {
            if (mutation.events?.target === state.machines) {
                callback(state.machines);
            }
        });
    };

    const subscribeToTasks = (callback: (tasks: any[]) => void) => {
        const tasks = useTasksStore();
        return subscribe(tasks, (mutation, state) => {
            if (mutation.events?.target === state.tasks) {
                callback(state.tasks);
            }
        });
    };

    const unsubscribeAll = () => {
        unsubscribers.forEach(unsubscribe => unsubscribe());
        unsubscribers.clear();
    };

    return {
        subscribe,
        subscribeToAuth,
        subscribeToMachines,
        subscribeToTasks,
        unsubscribeAll,
    };
};

/**
 * Composable for store persistence helpers
 */
export const useStorePersistence = () => {
    const stores = useStores();

    const exportAllSettings = () => {
        return {
            settings: stores.settings.exportSettings(),
            ui: {
                theme: stores.ui.currentTheme,
                sidebar: stores.ui.state.sidebar,
            },
            timestamp: new Date().toISOString(),
            version: '1.0',
        };
    };

    const importAllSettings = (data: any) => {
        try {
            if (data.settings) {
                stores.settings.importSettings(data.settings);
            }

            if (data.ui) {
                if (data.ui.theme) {
                    stores.ui.setTheme(data.ui.theme);
                }
                if (data.ui.sidebar) {
                    stores.ui.setSidebarOpen(data.ui.sidebar.open);
                    stores.ui.setSidebarMini(data.ui.sidebar.mini);
                }
            }

            return true;
        } catch (error) {
            return false;
        }
    };

    const clearAllData = () => {
        stores.auth.$reset();
        stores.settings.$reset();
        stores.ui.$reset();
        stores.notifications.$reset();

        // Clear localStorage
        if (typeof localStorage !== 'undefined') {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith('yardrover-')) {
                    localStorage.removeItem(key);
                }
            });
        }
    };

    return {
        exportAllSettings,
        importAllSettings,
        clearAllData,
    };
};

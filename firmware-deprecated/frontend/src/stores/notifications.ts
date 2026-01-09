import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { Notification, NotificationAction, ApiState } from './types';

export const useNotificationsStore = defineStore('notifications', () => {
    // State
    const notifications = ref<Notification[]>([]);
    const apiState = ref<ApiState>({
        loading: 'idle',
        error: null,
        lastUpdated: null,
    });

    // Getters
    const unreadNotifications = computed(() =>
        notifications.value.filter(notification => !notification.read)
    );

    const unreadCount = computed(() => unreadNotifications.value.length);

    const recentNotifications = computed(() =>
        notifications.value
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 10)
    );

    const notificationsByType = computed(() => {
        const grouped: Record<string, Notification[]> = {};
        notifications.value.forEach(notification => {
            if (!grouped[notification.type]) {
                grouped[notification.type] = [];
            }
            grouped[notification.type].push(notification);
        });
        return grouped;
    });

    const errorNotifications = computed(() =>
        notifications.value.filter(n => n.type === 'error')
    );

    const warningNotifications = computed(() =>
        notifications.value.filter(n => n.type === 'warning')
    );

    const infoNotifications = computed(() =>
        notifications.value.filter(n => n.type === 'info')
    );

    const successNotifications = computed(() =>
        notifications.value.filter(n => n.type === 'success')
    );

    const persistentNotifications = computed(() =>
        notifications.value.filter(n => n.persistent)
    );

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

    const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
        const newNotification: Notification = {
            id: generateId(),
            timestamp: new Date().toISOString(),
            read: false,
            ...notification,
        };

        notifications.value.unshift(newNotification);
        apiState.value.lastUpdated = new Date().toISOString();

        return newNotification;
    };

    const updateNotification = (id: string, updates: Partial<Notification>) => {
        const index = notifications.value.findIndex(n => n.id === id);
        if (index >= 0) {
            notifications.value[index] = { ...notifications.value[index], ...updates };
            apiState.value.lastUpdated = new Date().toISOString();
        }
    };

    const removeNotification = (id: string) => {
        const index = notifications.value.findIndex(n => n.id === id);
        if (index >= 0) {
            notifications.value.splice(index, 1);
            apiState.value.lastUpdated = new Date().toISOString();
        }
    };

    const markAsRead = (id: string) => {
        updateNotification(id, { read: true });
    };

    const markAsUnread = (id: string) => {
        updateNotification(id, { read: false });
    };

    const markAllAsRead = () => {
        notifications.value.forEach(notification => {
            if (!notification.read) {
                notification.read = true;
            }
        });
        apiState.value.lastUpdated = new Date().toISOString();
    };

    const clearAll = () => {
        notifications.value = [];
        apiState.value.lastUpdated = new Date().toISOString();
    };

    const clearRead = () => {
        notifications.value = notifications.value.filter(n => !n.read);
        apiState.value.lastUpdated = new Date().toISOString();
    };

    const clearType = (type: Notification['type']) => {
        notifications.value = notifications.value.filter(n => n.type !== type);
        apiState.value.lastUpdated = new Date().toISOString();
    };

    const clearOlderThan = (days: number) => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        notifications.value = notifications.value.filter(n =>
            new Date(n.timestamp) > cutoffDate
        );
        apiState.value.lastUpdated = new Date().toISOString();
    };

    // Convenience methods for different notification types
    const success = (title: string, message: string, actions?: NotificationAction[]) => {
        return addNotification({
            type: 'success',
            title,
            message,
            persistent: false,
            actions,
        });
    };

    const info = (title: string, message: string, actions?: NotificationAction[]) => {
        return addNotification({
            type: 'info',
            title,
            message,
            persistent: false,
            actions,
        });
    };

    const warning = (title: string, message: string, persistent = false, actions?: NotificationAction[]) => {
        return addNotification({
            type: 'warning',
            title,
            message,
            persistent,
            actions,
        });
    };

    const error = (title: string, message: string, persistent = true, actions?: NotificationAction[]) => {
        return addNotification({
            type: 'error',
            title,
            message,
            persistent,
            actions,
        });
    };

    // Machine-specific notifications
    const machineError = (machineName: string, error: string) => {
        return addNotification({
            type: 'error',
            title: `Machine Error: ${machineName}`,
            message: error,
            persistent: true,
            actions: [
                { label: 'View Details', action: 'machine.view' },
                { label: 'Dismiss', action: 'notification.dismiss' },
            ],
        });
    };

    const taskCompleted = (taskName: string, machineName: string) => {
        return addNotification({
            type: 'success',
            title: 'Task Completed',
            message: `${taskName} completed successfully on ${machineName}`,
            persistent: false,
            actions: [
                { label: 'View Task', action: 'task.view' },
            ],
        });
    };

    const taskFailed = (taskName: string, machineName: string, reason: string) => {
        return addNotification({
            type: 'error',
            title: 'Task Failed',
            message: `${taskName} failed on ${machineName}: ${reason}`,
            persistent: true,
            actions: [
                { label: 'Retry Task', action: 'task.retry' },
                { label: 'View Details', action: 'task.view' },
            ],
        });
    };

    const batteryLow = (machineName: string, batteryLevel: number) => {
        return addNotification({
            type: 'warning',
            title: 'Low Battery',
            message: `${machineName} battery is at ${batteryLevel}%`,
            persistent: false,
            actions: [
                { label: 'Return to Charger', action: 'machine.return_home' },
            ],
        });
    };

    const maintenanceReminder = (machineName: string, type: string) => {
        return addNotification({
            type: 'info',
            title: 'Maintenance Reminder',
            message: `${machineName} is due for ${type}`,
            persistent: true,
            actions: [
                { label: 'Schedule Service', action: 'maintenance.schedule' },
                { label: 'Mark Complete', action: 'maintenance.complete' },
            ],
        });
    };

    const weatherAlert = (condition: string, recommendation: string) => {
        return addNotification({
            type: 'warning',
            title: 'Weather Alert',
            message: `${condition}. ${recommendation}`,
            persistent: false,
            actions: [
                { label: 'View Weather', action: 'weather.view' },
            ],
        });
    };

    const securityAlert = (type: string, machineName: string) => {
        return addNotification({
            type: 'error',
            title: 'Security Alert',
            message: `${type} detected on ${machineName}`,
            persistent: true,
            actions: [
                { label: 'View Location', action: 'machine.locate' },
                { label: 'Call Support', action: 'support.call' },
            ],
        });
    };

    // Handle notification actions
    const executeAction = (notificationId: string, actionId: string) => {
        const notification = notifications.value.find(n => n.id === notificationId);
        if (!notification?.actions) return;

        const action = notification.actions.find(a => a.action === actionId);
        if (!action) return;

        // Handle different action types
        switch (action.action) {
            case 'notification.dismiss':
                removeNotification(notificationId);
                break;

            case 'machine.view':
            case 'task.view':
            case 'weather.view':
                // These would typically navigate to specific pages
                markAsRead(notificationId);
                break;

            case 'task.retry':
                // This would trigger task retry logic
                markAsRead(notificationId);
                break;

            case 'machine.return_home':
                // This would send return command to machine
                markAsRead(notificationId);
                break;

            default:
                console.warn(`Unknown notification action: ${action.action}`);
        }
    };

    // Auto-cleanup old notifications
    const autoCleanup = () => {
        // Remove non-persistent notifications older than 7 days
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 7);

        notifications.value = notifications.value.filter(n =>
            n.persistent || new Date(n.timestamp) > cutoffDate
        );
    };

    // Simple ID generator
    const generateId = (): string => {
        return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    };

    // WebSocket handlers for real-time notifications
    const handleWebSocketUpdate = (eventType: string, data: any) => {
        switch (eventType) {
            case 'machine.error':
                machineError(data.machineName, data.error);
                break;

            case 'machine.battery_low':
                batteryLow(data.machineName, data.batteryLevel);
                break;

            case 'task.completed':
                taskCompleted(data.taskName, data.machineName);
                break;

            case 'task.failed':
                taskFailed(data.taskName, data.machineName, data.reason);
                break;

            case 'maintenance.reminder':
                maintenanceReminder(data.machineName, data.type);
                break;

            case 'weather.alert':
                weatherAlert(data.condition, data.recommendation);
                break;

            case 'security.alert':
                securityAlert(data.type, data.machineName);
                break;
        }
    };

    // Reset store state
    const $reset = () => {
        notifications.value = [];
        apiState.value = {
            loading: 'idle',
            error: null,
            lastUpdated: null,
        };
    };

    return {
        // State
        notifications: computed(() => notifications.value),
        apiState: computed(() => apiState.value),

        // Getters
        unreadNotifications,
        unreadCount,
        recentNotifications,
        notificationsByType,
        errorNotifications,
        warningNotifications,
        infoNotifications,
        successNotifications,
        persistentNotifications,
        isLoading,
        hasError,

        // Actions
        addNotification,
        updateNotification,
        removeNotification,
        markAsRead,
        markAsUnread,
        markAllAsRead,
        clearAll,
        clearRead,
        clearType,
        clearOlderThan,

        // Convenience methods
        success,
        info,
        warning,
        error,

        // Machine notifications
        machineError,
        taskCompleted,
        taskFailed,
        batteryLow,
        maintenanceReminder,
        weatherAlert,
        securityAlert,

        // Utility
        executeAction,
        autoCleanup,
        handleWebSocketUpdate,
        clearError,
        $reset,
    };
});

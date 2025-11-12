import { computed, onMounted, onUnmounted } from 'vue';
import { useWebSocketStore } from '../websocket';
import { useMachineStore } from '../machine';
import { useTasksStore } from '../tasks';
import { useYardStore } from '../yard';
import { useNotificationsStore } from '../notifications';

/**
 * Composable for managing real-time updates via WebSocket
 * Handles WebSocket connections and distributes events to appropriate stores
 */
export const useRealTime = () => {
    const websocket = useWebSocketStore();
    const machine = useMachineStore();
    const tasks = useTasksStore();
    const yard = useYardStore();
    const notifications = useNotificationsStore();

    // WebSocket connection management
    const connect = (url?: string) => {
        const wsUrl = url || 'ws://localhost:8080/ws';
        websocket.connect(wsUrl);
    };

    const disconnect = () => {
        websocket.disconnect();
    };

    // Event listeners for different types of real-time updates
    const setupEventListeners = () => {
        // Machine status updates
        websocket.addEventListener('machine.status', (data) => {
            machine.handleWebSocketUpdate('machine.status', data);
        });

        websocket.addEventListener('machine.location', (data) => {
            machine.handleWebSocketUpdate('machine.location', data);
        });

        websocket.addEventListener('machine.battery', (data) => {
            machine.handleWebSocketUpdate('machine.battery', data);
        });

        websocket.addEventListener('machine.error', (data) => {
            machine.handleWebSocketUpdate('machine.error', data);
            notifications.handleWebSocketUpdate('machine.error', data);
        });

        // Task updates
        websocket.addEventListener('task.created', (data) => {
            tasks.handleWebSocketUpdate('task.created', data);
        });

        websocket.addEventListener('task.status', (data) => {
            tasks.handleWebSocketUpdate('task.status', data);
        });

        websocket.addEventListener('task.progress', (data) => {
            tasks.handleWebSocketUpdate('task.progress', data);
        });

        websocket.addEventListener('task.completed', (data) => {
            tasks.handleWebSocketUpdate('task.completed', data);
            notifications.handleWebSocketUpdate('task.completed', data);
        });

        websocket.addEventListener('task.failed', (data) => {
            tasks.handleWebSocketUpdate('task.failed', data);
            notifications.handleWebSocketUpdate('task.failed', data);
        });

        // Yard updates
        websocket.addEventListener('yard.updated', (data) => {
            yard.handleWebSocketUpdate('yard.updated', data);
        });

        websocket.addEventListener('zone.status', (data) => {
            yard.handleWebSocketUpdate('zone.status', data);
        });

        // Notification events
        websocket.addEventListener('notification', (data) => {
            notifications.handleWebSocketUpdate('notification', data);
        });

        // Weather alerts
        websocket.addEventListener('weather.alert', (data) => {
            notifications.handleWebSocketUpdate('weather.alert', data);
        });

        // Security alerts
        websocket.addEventListener('security.alert', (data) => {
            notifications.handleWebSocketUpdate('security.alert', data);
        });
    };

    // Subscribe to specific machine updates
    const subscribeToMachine = (machineId: string) => {
        websocket.subscribeToMachine(machineId);
    };

    const unsubscribeFromMachine = (machineId: string) => {
        websocket.unsubscribeFromMachine(machineId);
    };

    // Subscribe to yard updates
    const subscribeToYard = (yardId: string) => {
        websocket.subscribeToYard(yardId);
    };

    const unsubscribeFromYard = (yardId: string) => {
        websocket.unsubscribeFromYard(yardId);
    };

    // Connection status
    const connectionStatus = computed(() => websocket.connectionStatus);
    const isConnected = computed(() => websocket.isConnected);
    const isConnecting = computed(() => websocket.isConnecting);

    // Recent events
    const recentEvents = computed(() => websocket.recentEvents);

    // Auto-reconnect configuration
    const configureReconnect = (maxAttempts: number = 5, interval: number = 5000) => {
        websocket.setReconnectConfig(maxAttempts, interval);
    };

    // Send real-time commands
    const sendMachineCommand = (machineId: string, command: string, parameters?: any) => {
        websocket.send({
            type: 'machine.command',
            payload: {
                machineId,
                command,
                parameters,
                timestamp: new Date().toISOString(),
            },
        });
    };

    const sendTaskCommand = (taskId: string, command: string) => {
        websocket.send({
            type: 'task.command',
            payload: {
                taskId,
                command,
                timestamp: new Date().toISOString(),
            },
        });
    };

    // Real-time data synchronization
    const syncData = () => {
        websocket.send({
            type: 'sync.request',
            payload: {
                timestamp: new Date().toISOString(),
            },
        });
    };

    // Heartbeat/keepalive
    const startHeartbeat = () => {
        const interval = setInterval(() => {
            if (isConnected.value) {
                websocket.send({
                    type: 'ping',
                    payload: {
                        timestamp: new Date().toISOString(),
                    },
                });
            }
        }, 30000); // 30 seconds

        return () => clearInterval(interval);
    };

    // Setup and cleanup
    onMounted(() => {
        setupEventListeners();
    });

    onUnmounted(() => {
        websocket.removeAllEventListeners();
    });

    return {
        // Connection management
        connect,
        disconnect,
        connectionStatus,
        isConnected,
        isConnecting,

        // Subscriptions
        subscribeToMachine,
        unsubscribeFromMachine,
        subscribeToYard,
        unsubscribeFromYard,

        // Commands
        sendMachineCommand,
        sendTaskCommand,
        syncData,

        // Configuration
        configureReconnect,
        startHeartbeat,

        // Data
        recentEvents,
    };
};

/**
 * Composable for live machine monitoring
 * Provides real-time machine status updates
 */
export const useLiveMachineMonitoring = (machineId: string) => {
    const realtime = useRealTime();
    const machine = useMachineStore();

    // Subscribe to this machine's updates
    onMounted(() => {
        realtime.subscribeToMachine(machineId);
    });

    onUnmounted(() => {
        realtime.unsubscribeFromMachine(machineId);
    });

    // Get current machine data
    const machineData = computed(() => {
        return machine.machines.get(machineId);
    });

    // Live status updates
    const liveStatus = computed(() => {
        return machineData.value?.status;
    });

    const isOnline = computed(() => {
        return liveStatus.value?.status !== 'offline';
    });

    const lastUpdate = computed(() => {
        return liveStatus.value?.lastSeen;
    });

    // Send commands to this machine
    const sendCommand = (command: string, parameters?: any) => {
        realtime.sendMachineCommand(machineId, command, parameters);
    };

    return {
        machineData,
        liveStatus,
        isOnline,
        lastUpdate,
        sendCommand,
    };
};

/**
 * Composable for live task monitoring
 * Provides real-time task progress updates
 */
export const useLiveTaskMonitoring = (taskId: string) => {
    const realtime = useRealTime();
    const tasks = useTasksStore();

    // Get current task data
    const taskData = computed(() => {
        return tasks.tasks.find(task => task.id === taskId);
    });

    // Live progress updates
    const liveProgress = computed(() => {
        return tasks.getTaskProgress(taskId);
    });

    const isActive = computed(() => {
        return taskData.value?.status === 'running';
    });

    // Send commands to this task
    const sendCommand = (command: string) => {
        realtime.sendTaskCommand(taskId, command);
    };

    return {
        taskData,
        liveProgress,
        isActive,
        sendCommand,
    };
};

/**
 * Composable for live notifications
 * Manages real-time notification display
 */
export const useLiveNotifications = () => {
    const notifications = useNotificationsStore();
    const realtime = useRealTime();

    // Recent notifications
    const liveNotifications = computed(() => {
        return notifications.recentNotifications;
    });

    const unreadCount = computed(() => {
        return notifications.unreadCount;
    });

    // Auto-dismiss notifications after timeout
    const autoDismiss = (notificationId: string, timeout: number = 5000) => {
        setTimeout(() => {
            notifications.markAsRead(notificationId);
        }, timeout);
    };

    // Send real-time notification to other users
    const broadcastNotification = (type: string, title: string, message: string) => {
        realtime.websocket.send({
            type: 'notification.broadcast',
            payload: {
                type,
                title,
                message,
                timestamp: new Date().toISOString(),
            },
        });
    };

    return {
        liveNotifications,
        unreadCount,
        autoDismiss,
        broadcastNotification,
    };
};

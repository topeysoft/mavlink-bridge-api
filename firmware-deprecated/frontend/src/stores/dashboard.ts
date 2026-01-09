import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface DashboardStats {
    totalMachines: number
    activeMachines: number
    tasksCompleted: number
    uptime: string
    yardCoverage: number
    energyUsed: number
}

export interface DashboardAlert {
    id: string
    type: 'info' | 'warning' | 'error' | 'success'
    title: string
    message: string
    timestamp: string
    read: boolean
}

export interface DashboardActivity {
    id: string
    type: 'task' | 'machine' | 'system' | 'maintenance'
    title: string
    description: string
    timestamp: string
    machineId?: string
    taskId?: string
}

export const useDashboardStore = defineStore('dashboard', () => {
    // State
    const stats = ref<DashboardStats>({
        totalMachines: 3,
        activeMachines: 2,
        tasksCompleted: 15,
        uptime: '24h 15m',
        yardCoverage: 85.5,
        energyUsed: 12.3
    })

    const alerts = ref<DashboardAlert[]>([
        {
            id: '1',
            type: 'warning',
            title: 'Low Battery',
            message: 'YardRover Beta battery is below 20%',
            timestamp: '2025-09-04T10:30:00Z',
            read: false
        },
        {
            id: '2',
            type: 'success',
            title: 'Task Completed',
            message: 'Front yard mowing completed successfully',
            timestamp: '2025-09-04T09:45:00Z',
            read: false
        },
        {
            id: '3',
            type: 'info',
            title: 'Weather Update',
            message: 'Rain expected in 2 hours - operations may pause',
            timestamp: '2025-09-04T09:00:00Z',
            read: true
        }
    ])

    const activities = ref<DashboardActivity[]>([
        {
            id: '1',
            type: 'task',
            title: 'Morning Mow Started',
            description: 'YardRover Alpha began morning mowing routine',
            timestamp: '2025-09-04T08:00:00Z',
            machineId: 'YR001',
            taskId: 'task_001'
        },
        {
            id: '2',
            type: 'machine',
            title: 'Machine Status Update',
            description: 'YardRover Beta returned to charging station',
            timestamp: '2025-09-04T07:30:00Z',
            machineId: 'YR002'
        },
        {
            id: '3',
            type: 'system',
            title: 'System Health Check',
            description: 'All systems operational - health score: 98%',
            timestamp: '2025-09-04T07:00:00Z'
        },
        {
            id: '4',
            type: 'maintenance',
            title: 'Blade Maintenance Due',
            description: 'YardRover Gamma is due for blade sharpening',
            timestamp: '2025-09-04T06:30:00Z',
            machineId: 'YR003'
        }
    ])

    const isLoading = ref(false)
    const lastUpdated = ref(new Date().toISOString())

    // Getters
    const unreadAlertsCount = computed(() =>
        alerts.value.filter(alert => !alert.read).length
    )

    const criticalAlertsCount = computed(() =>
        alerts.value.filter(alert => alert.type === 'error' && !alert.read).length
    )

    const recentActivities = computed(() =>
        activities.value.slice(0, 10)
    )

    const systemHealthScore = computed(() => {
        const errorAlerts = alerts.value.filter(alert => alert.type === 'error').length
        const warningAlerts = alerts.value.filter(alert => alert.type === 'warning').length

        let baseScore = 100
        baseScore -= errorAlerts * 15
        baseScore -= warningAlerts * 5

        return Math.max(0, Math.min(100, baseScore))
    })

    // Actions
    const refreshDashboard = async () => {
        isLoading.value = true
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000))

            // Update stats with mock data
            stats.value = {
                ...stats.value,
                activeMachines: Math.floor(Math.random() * 3) + 1,
                tasksCompleted: stats.value.tasksCompleted + Math.floor(Math.random() * 3),
                yardCoverage: Math.round((Math.random() * 20 + 80) * 10) / 10,
                energyUsed: Math.round((Math.random() * 5 + 10) * 10) / 10
            }

            lastUpdated.value = new Date().toISOString()
        } finally {
            isLoading.value = false
        }
    }

    const markAlertAsRead = (alertId: string) => {
        const alert = alerts.value.find(a => a.id === alertId)
        if (alert) {
            alert.read = true
        }
    }

    const markAllAlertsAsRead = () => {
        alerts.value.forEach(alert => {
            alert.read = true
        })
    }

    const dismissAlert = (alertId: string) => {
        const index = alerts.value.findIndex(a => a.id === alertId)
        if (index > -1) {
            alerts.value.splice(index, 1)
        }
    }

    const addAlert = (alert: Omit<DashboardAlert, 'id' | 'timestamp' | 'read'>) => {
        const newAlert: DashboardAlert = {
            ...alert,
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            read: false
        }
        alerts.value.unshift(newAlert)
    }

    const addActivity = (activity: Omit<DashboardActivity, 'id' | 'timestamp'>) => {
        const newActivity: DashboardActivity = {
            ...activity,
            id: Date.now().toString(),
            timestamp: new Date().toISOString()
        }
        activities.value.unshift(newActivity)

        // Keep only last 50 activities
        if (activities.value.length > 50) {
            activities.value = activities.value.slice(0, 50)
        }
    }

    const updateStats = (newStats: Partial<DashboardStats>) => {
        stats.value = { ...stats.value, ...newStats }
        lastUpdated.value = new Date().toISOString()
    }

    // Initialize
    const initialize = async () => {
        await refreshDashboard()
    }

    return {
        // State
        stats,
        alerts,
        activities,
        isLoading,
        lastUpdated,

        // Getters
        unreadAlertsCount,
        criticalAlertsCount,
        recentActivities,
        systemHealthScore,

        // Actions
        refreshDashboard,
        markAlertAsRead,
        markAllAlertsAsRead,
        dismissAlert,
        addAlert,
        addActivity,
        updateStats,
        initialize
    }
})

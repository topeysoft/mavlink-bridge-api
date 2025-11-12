// Type adapters to convert between service types and store types
import type { User as ServiceUser } from '@/services/types/user.types';
import type { MachineStatus as ServiceMachineStatus } from '@/services/types/machine.types';
import type { Task as ServiceTask } from '@/services/types/machine.types';
import type { User as StoreUser, MachineStatus as StoreMachineStatus, Task as StoreTask } from './types';

// Convert service user to store user
export const adaptServiceUserToStore = (serviceUser: ServiceUser): StoreUser => {
    return {
        ...serviceUser,
        preferences: {
            theme: serviceUser.preferences?.theme || 'auto',
            language: serviceUser.preferences?.language || 'en',
            timezone: serviceUser.preferences?.timezone || 'UTC',
            notifications: serviceUser.preferences?.notifications || {
                email: true,
                push: true,
                taskCompleted: true,
                batteryLow: true,
                maintenance: true,
                errors: true,
            },
            dashboard: serviceUser.preferences?.dashboard || {
                defaultView: 'map',
                refreshInterval: 30,
                showWeather: true,
                autoRefresh: true,
            },
        },
    };
};

// Convert service machine status to store machine status
export const adaptServiceMachineStatusToStore = (serviceMachineStatus: ServiceMachineStatus): StoreMachineStatus => {
    return {
        id: serviceMachineStatus.id,
        name: serviceMachineStatus.name,
        status: serviceMachineStatus.status,
        battery: serviceMachineStatus.batteryLevel,
        location: {
            latitude: serviceMachineStatus.location.latitude,
            longitude: serviceMachineStatus.location.longitude,
            accuracy: serviceMachineStatus.location.accuracy,
        },
        lastSeen: serviceMachineStatus.lastSeen,
        currentTask: undefined, // This would come from task data
        isConnected: serviceMachineStatus.status !== 'offline',
        // Additional properties from service
        runtime: serviceMachineStatus.runtime,
        temperature: serviceMachineStatus.temperature,
        errors: serviceMachineStatus.errors.map(e => e.message),
    };
};

// Convert service task to store task
export const adaptServiceTaskToStore = (serviceTask: ServiceTask): StoreTask => {
    // Map service task status to store task status
    let storeStatus: StoreTask['status'];
    switch (serviceTask.status) {
        case 'pending':
            storeStatus = 'pending';
            break;
        case 'running':
            storeStatus = 'running';
            break;
        case 'completed':
            storeStatus = 'completed';
            break;
        case 'failed':
            storeStatus = 'failed';
            break;
        case 'cancelled':
            storeStatus = 'cancelled';
            break;
        default:
            storeStatus = 'pending';
    }

    return {
        ...serviceTask,
        status: storeStatus,
        machineId: serviceTask.machineId,
        // Remove properties that don't exist in service Task type
        // yardId and zones would be handled differently
        estimatedDuration: 60, // Default value
        actualDuration: serviceTask.duration,
        yardId: '', // Would need to be set from context
        zones: [], // Would need to be set from context
    };
};

// Convert store user to service user for API calls
export const adaptStoreUserToService = (storeUser: StoreUser): Partial<ServiceUser> => {
    return {
        id: storeUser.id,
        email: storeUser.email,
        name: storeUser.firstName + ' ' + storeUser.lastName,
        role: storeUser.role,
        avatar: storeUser.avatar,
        preferences: {
            notifications: storeUser.preferences.notifications,
            dashboard: storeUser.preferences.dashboard,
        },
    };
};

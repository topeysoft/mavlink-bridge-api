import type { AxiosInstance } from 'axios';
import { apiClient } from '../api/client';
import type {
    MachineStatus,
    MachineCommand,
    MachineConfiguration,
    MachineSensor,
    MachineAlert,
    Task,
    TaskProgress
} from '../types/machine.types';
import type { ApiResponse, PaginatedResponse } from '../api/client';

export class MachineService {
    private client: AxiosInstance;

    constructor(client: AxiosInstance = apiClient) {
        this.client = client;
    }

    // Machine Status Operations
    async getMachineStatus (machineId: string): Promise<MachineStatus> {
        const response = await this.client.get<ApiResponse<MachineStatus>>(`/machines/${machineId}/status`);
        return response.data;
    }

    async getAllMachines (): Promise<MachineStatus[]> {
        const response = await this.client.get<ApiResponse<MachineStatus[]>>('/machines');
        return response.data;
    }

    async getMachineHistory (machineId: string, hours = 24): Promise<MachineStatus[]> {
        const response = await this.client.get<ApiResponse<MachineStatus[]>>(
            `/machines/${machineId}/history?hours=${hours}`
        );
        return response.data;
    }

    // Machine Control Operations
    async sendCommand (machineId: string, command: MachineCommand): Promise<void> {
        await this.client.post(`/machines/${machineId}/commands`, command);
    }

    async startMachine (machineId: string, parameters?: Record<string, any>): Promise<void> {
        await this.sendCommand(machineId, {
            type: 'start',
            parameters,
            priority: 'high'
        });
    }

    async stopMachine (machineId: string): Promise<void> {
        await this.sendCommand(machineId, {
            type: 'stop',
            priority: 'high'
        });
    }

    async pauseMachine (machineId: string): Promise<void> {
        await this.sendCommand(machineId, {
            type: 'pause',
            priority: 'medium'
        });
    }

    async resumeMachine (machineId: string): Promise<void> {
        await this.sendCommand(machineId, {
            type: 'resume',
            priority: 'medium'
        });
    }

    async emergencyStop (machineId: string): Promise<void> {
        await this.sendCommand(machineId, {
            type: 'emergency_stop',
            priority: 'critical'
        });
    }

    async returnHome (machineId: string): Promise<void> {
        await this.sendCommand(machineId, {
            type: 'return_home',
            priority: 'medium'
        });
    }

    // Machine Configuration
    async getMachineConfiguration (machineId: string): Promise<MachineConfiguration> {
        const response = await this.client.get<ApiResponse<MachineConfiguration>>(`/machines/${machineId}/config`);
        return response.data;
    }

    async updateMachineConfiguration (machineId: string, config: Partial<MachineConfiguration>): Promise<MachineConfiguration> {
        const response = await this.client.put<ApiResponse<MachineConfiguration>>(`/machines/${machineId}/config`, config);
        return response.data;
    }

    // Task Management
    async getTasks (machineId: string, status?: string): Promise<Task[]> {
        const params = status ? { status } : {};
        const response = await this.client.get<ApiResponse<Task[]>>(`/machines/${machineId}/tasks`, { params });
        return response.data;
    }

    async createTask (machineId: string, task: Omit<Task, 'id' | 'status' | 'createdBy' | 'machineId'>): Promise<Task> {
        const response = await this.client.post<ApiResponse<Task>>(`/machines/${machineId}/tasks`, task);
        return response.data;
    }

    async updateTask (taskId: string, updates: Partial<Task>): Promise<Task> {
        const response = await this.client.put<ApiResponse<Task>>(`/tasks/${taskId}`, updates);
        return response.data;
    }

    async deleteTask (taskId: string): Promise<void> {
        await this.client.delete(`/tasks/${taskId}`);
    }

    async executeTask (taskId: string): Promise<void> {
        await this.client.post(`/tasks/${taskId}/execute`);
    }

    async getTaskProgress (taskId: string): Promise<TaskProgress> {
        const response = await this.client.get<ApiResponse<TaskProgress>>(`/tasks/${taskId}/progress`);
        return response.data;
    }

    // Sensor Data
    async getMachineSensors (machineId: string): Promise<MachineSensor[]> {
        const response = await this.client.get<ApiResponse<MachineSensor[]>>(`/machines/${machineId}/sensors`);
        return response.data;
    }

    async getSensorHistory (machineId: string, sensorType: string, hours = 24): Promise<MachineSensor[]> {
        const response = await this.client.get<ApiResponse<MachineSensor[]>>(
            `/machines/${machineId}/sensors/${sensorType}/history?hours=${hours}`
        );
        return response.data;
    }

    // Alerts and Notifications
    async getMachineAlerts (machineId: string, page = 1, limit = 20): Promise<PaginatedResponse<MachineAlert>> {
        const response = await this.client.get<PaginatedResponse<MachineAlert>>(
            `/machines/${machineId}/alerts?page=${page}&limit=${limit}`
        );
        return response.data;
    }

    async acknowledgeAlert (alertId: string): Promise<void> {
        await this.client.post(`/alerts/${alertId}/acknowledge`);
    }

    async resolveAlert (alertId: string): Promise<void> {
        await this.client.post(`/alerts/${alertId}/resolve`);
    }

    // Maintenance
    async scheduleMaintenance (machineId: string, maintenanceData: {
        type: string;
        scheduledAt: string;
        description?: string;
        estimatedDuration?: number;
    }): Promise<Task> {
        const response = await this.client.post<ApiResponse<Task>>(`/machines/${machineId}/maintenance`, maintenanceData);
        return response.data;
    }

    async getMaintenanceHistory (machineId: string): Promise<Task[]> {
        const response = await this.client.get<ApiResponse<Task[]>>(`/machines/${machineId}/maintenance/history`);
        return response.data;
    }

    // Statistics and Analytics
    async getMachineStats (machineId: string, period = '30d'): Promise<{
        totalRuntime: number;
        areaCovered: number;
        batteryUsage: number;
        tasksCompleted: number;
        averageSpeed: number;
        efficiency: number;
    }> {
        const response = await this.client.get(`/machines/${machineId}/stats?period=${period}`);
        return response.data;
    }

    // Real-time Location
    async getMachineLocation (machineId: string): Promise<{
        latitude: number;
        longitude: number;
        accuracy: number;
        heading: number;
        speed: number;
        timestamp: string;
    }> {
        const response = await this.client.get(`/machines/${machineId}/location`);
        return response.data;
    }

    async getLocationHistory (machineId: string, hours = 24): Promise<Array<{
        latitude: number;
        longitude: number;
        timestamp: string;
        heading: number;
        speed: number;
    }>> {
        const response = await this.client.get(`/machines/${machineId}/location/history?hours=${hours}`);
        return response.data;
    }
}

// Export singleton instance
export const machineService = new MachineService();

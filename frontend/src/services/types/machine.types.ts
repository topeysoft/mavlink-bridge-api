// Machine-related TypeScript interfaces
export interface MachineStatus {
    id: string;
    name: string;
    status: 'idle' | 'running' | 'paused' | 'stopped' | 'error' | 'maintenance';
    mode: 'manual' | 'auto' | 'scheduled' | 'remote';
    batteryLevel: number;
    location: {
        latitude: number;
        longitude: number;
        accuracy?: number;
    };
    orientation: number; // degrees
    speed: number; // km/h
    lastSeen: string; // ISO date string
    uptime: number; // seconds
    firmwareVersion: string;
    hardwareVersion: string;
}

export interface MachineCommand {
    type: 'start' | 'stop' | 'pause' | 'resume' | 'return_home' | 'emergency_stop';
    parameters?: Record<string, any>;
    priority?: 'low' | 'medium' | 'high' | 'critical';
}

export interface MachineConfiguration {
    cuttingHeight: number; // cm
    speed: 'slow' | 'medium' | 'fast';
    pattern: 'random' | 'spiral' | 'lines' | 'zones';
    edgeMode: boolean;
    rainSensor: boolean;
    collisionSensitivity: 'low' | 'medium' | 'high';
    workingHours: {
        start: string; // HH:MM
        end: string; // HH:MM
        days: number[]; // 0-6, Sunday to Saturday
    };
}

export interface Task {
    id: string;
    name: string;
    type: 'mowing' | 'edging' | 'spot_clean' | 'return_home' | 'maintenance';
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    priority: 'low' | 'medium' | 'high';
    scheduledAt?: string; // ISO date string
    startedAt?: string; // ISO date string
    completedAt?: string; // ISO date string
    estimatedDuration?: number; // minutes
    actualDuration?: number; // minutes
    progress: number; // 0-100
    area?: {
        name: string;
        coordinates: Array<{
            latitude: number;
            longitude: number;
        }>;
    };
    parameters: Record<string, any>;
    createdBy: string; // user ID
    machineId: string;
}

export interface TaskProgress {
    taskId: string;
    progress: number; // 0-100
    currentAction: string;
    estimatedTimeRemaining: number; // minutes
    areaCompleted: number; // square meters
    areaTotal: number; // square meters
    batteryUsed: number; // percentage
    issues?: Array<{
        type: 'obstacle' | 'weather' | 'battery' | 'mechanical';
        message: string;
        timestamp: string;
    }>;
}

export interface MachineSensor {
    type: 'battery' | 'gps' | 'collision' | 'rain' | 'temperature' | 'blade';
    value: number;
    unit: string;
    status: 'normal' | 'warning' | 'critical';
    lastReading: string; // ISO date string
    calibrated: boolean;
}

export interface MachineAlert {
    id: string;
    machineId: string;
    type: 'error' | 'warning' | 'info' | 'maintenance';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    description?: string;
    timestamp: string;
    acknowledged: boolean;
    resolvedAt?: string;
    actions?: Array<{
        label: string;
        action: string;
        parameters?: Record<string, any>;
    }>;
}

// Common store types and interfaces
import type { Router } from 'vue-router';

// Base store interface
export interface BaseStore {
    router?: Router;
    $reset: () => void;
}

// Store state status
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface ApiState {
    loading: LoadingState;
    error: string | null;
    lastUpdated: string | null;
}

// Machine related types
export interface MachineLocation {
    latitude: number;
    longitude: number;
    accuracy?: number;
    heading?: number;
}

export interface MachineStatus {
    id: string;
    name: string;
    status: 'idle' | 'running' | 'paused' | 'stopped' | 'error' | 'maintenance';
    mode: 'mowing' | 'snow' | 'leaf' | 'towing' | 'patrol' | 'manual';
    batteryLevel: number;
    location: MachineLocation;
    speed: number; // km/h
    runtime: number; // minutes
    uptime: number; // seconds
    lastSeen: string;
    firmwareVersion: string;
    temperature: number; // Celsius
    errors: MachineError[];
}

export interface MachineError {
    id: string;
    code: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    timestamp: string;
    resolved: boolean;
}

// Task related types
export interface Task {
    id: string;
    name: string;
    type: 'mowing' | 'edging' | 'spot_clean' | 'return_home' | 'maintenance';
    status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    progress: number; // 0-100
    estimatedDuration: number; // minutes
    actualDuration?: number; // minutes
    scheduledAt?: string;
    startedAt?: string;
    completedAt?: string;
    yardId: string;
    zones: string[];
    parameters: Record<string, any>;
    createdBy: string;
    machineId: string;
}

export interface TaskProgress {
    taskId: string;
    progress: number;
    currentAction: string;
    estimatedTimeRemaining: number;
    areaCompleted: number;
    areaTotal: number;
    batteryUsed: number;
    issues: TaskIssue[];
}

export interface TaskIssue {
    type: 'obstacle' | 'weather' | 'battery' | 'mechanical' | 'boundary';
    message: string;
    timestamp: string;
    severity: 'warning' | 'error';
    resolved: boolean;
}

// User related types
export interface User {
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    role: 'user' | 'admin' | 'technician';
    preferences: UserPreferences;
    subscription?: UserSubscription;
    createdAt: string;
    lastLoginAt?: string;
}

export interface UserPreferences {
    theme: 'light' | 'dark' | 'auto';
    language: 'en' | 'es' | 'fr' | 'de';
    timezone: string;
    notifications: {
        email: boolean;
        push: boolean;
        taskCompleted: boolean;
        batteryLow: boolean;
        maintenance: boolean;
        errors: boolean;
    };
    dashboard: {
        defaultView: 'map' | 'status' | 'tasks' | 'analytics';
        refreshInterval: number;
        showWeather: boolean;
        autoRefresh: boolean;
    };
}

export interface UserSubscription {
    plan: 'basic' | 'premium' | 'professional';
    status: 'active' | 'cancelled' | 'expired';
    endDate: string;
    features: string[];
}

// Yard related types
export interface Yard {
    id: string;
    name: string;
    address: string;
    area: number; // square meters
    boundaries: Array<{ latitude: number; longitude: number }>;
    zones: YardZone[];
    obstacles: Obstacle[];
    chargingStation: { latitude: number; longitude: number };
    createdAt: string;
    ownerId: string;
}

export interface YardZone {
    id: string;
    name: string;
    type: 'mowing' | 'no_mow' | 'slow_mow' | 'flower_bed' | 'trees';
    boundaries: Array<{ latitude: number; longitude: number }>;
    area: number;
    priority: 'low' | 'medium' | 'high';
    color: string;
    active: boolean;
    lastMowed?: string;
}

export interface Obstacle {
    id: string;
    name: string;
    type: 'permanent' | 'temporary' | 'seasonal';
    location: { latitude: number; longitude: number };
    size?: { width: number; length: number };
    active: boolean;
    avoidanceDistance: number;
}

// Weather related types
export interface WeatherData {
    temperature: number;
    humidity: number;
    precipitation: number;
    windSpeed: number;
    conditions: 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'stormy';
    suitable: boolean; // for mowing
    lastUpdated: string;
}

// Notification types
export interface Notification {
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    timestamp: string;
    read: boolean;
    persistent: boolean;
    actions?: NotificationAction[];
}

export interface NotificationAction {
    label: string;
    action: string;
    style?: 'primary' | 'secondary' | 'danger';
}

// WebSocket types
export interface WebSocketState {
    connected: boolean;
    connecting: boolean;
    lastConnected?: string;
    reconnectAttempts: number;
    maxReconnectAttempts: number;
    reconnectInterval: number;
    events: WebSocketEvent[];
}

export interface WebSocketEvent {
    id: string;
    type: string;
    data: any;
    timestamp: string;
}

// UI State types
export interface UIState {
    sidebar: {
        open: boolean;
        mini: boolean;
    };
    modals: {
        [key: string]: boolean;
    };
    dialogs: {
        [key: string]: boolean;
    };
    loading: {
        [key: string]: boolean;
    };
    theme: 'light' | 'dark';
    breadcrumbs: Breadcrumb[];
    pageTitle: string;
}

export interface Breadcrumb {
    label: string;
    to?: string;
    icon?: string;
}

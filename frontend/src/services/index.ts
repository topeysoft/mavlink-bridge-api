// Main services entry point
export * from './api/client';
export * from './api/interceptors';
export * from './api/websocket';

export * from './machine/MachineService';
export * from './user/AuthService';
export * from './yard/YardService';

export * from './types/machine.types';
export * from './types/user.types';
export * from './types/yard.types';

// Service initialization
import { apiClient, createAuthenticatedClient } from './api/client';
import { setupInterceptors, TokenManager } from './api/interceptors';
import { initWebSocket } from './api/websocket';
import { MachineService } from './machine/MachineService';
import { AuthService, UserService } from './user/AuthService';
import { YardService } from './yard/YardService';

// Setup interceptors on the main API client
setupInterceptors(apiClient);

// Create authenticated service instances
const tokenManager = TokenManager.getInstance();
const authClient = createAuthenticatedClient();
setupInterceptors(authClient);

// Export configured service instances
export const machineService = new MachineService(authClient);
export const authService = new AuthService(authClient);
export const userService = new UserService(authClient);
export const yardService = new YardService(authClient);

// Initialize WebSocket connection
export const initializeWebSocket = (baseUrl?: string) => {
    try {
        return initWebSocket(baseUrl);
    } catch (error) {
        console.error('Failed to initialize WebSocket:', error);
        return null;
    }
};

// API Configuration
export const API_ENDPOINTS = {
    // Authentication
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    ME: '/auth/me',

    // Machines
    MACHINES: '/machines',
    MACHINE_STATUS: (id: string) => `/machines/${id}/status`,
    MACHINE_COMMANDS: (id: string) => `/machines/${id}/commands`,
    MACHINE_CONFIG: (id: string) => `/machines/${id}/config`,
    MACHINE_TASKS: (id: string) => `/machines/${id}/tasks`,
    MACHINE_SENSORS: (id: string) => `/machines/${id}/sensors`,
    MACHINE_ALERTS: (id: string) => `/machines/${id}/alerts`,

    // Tasks
    TASKS: '/tasks',
    TASK_DETAIL: (id: string) => `/tasks/${id}`,
    TASK_EXECUTE: (id: string) => `/tasks/${id}/execute`,
    TASK_PROGRESS: (id: string) => `/tasks/${id}/progress`,

    // Yards
    YARDS: '/yards',
    YARD_DETAIL: (id: string) => `/yards/${id}`,
    YARD_ZONES: (id: string) => `/yards/${id}/zones`,
    YARD_OBSTACLES: (id: string) => `/yards/${id}/obstacles`,
    YARD_WEATHER: (id: string) => `/yards/${id}/weather`,
    YARD_SCHEDULES: (id: string) => `/yards/${id}/schedules`,

    // WebSocket
    WS_MACHINE_STATUS: 'machine.status',
    WS_MACHINE_LOCATION: 'machine.location',
    WS_TASK_PROGRESS: 'task.progress',
    WS_BATTERY_LEVEL: 'machine.battery',
    WS_OBSTACLE_DETECTED: 'obstacle.detected',
} as const;

// Error types for better error handling
export class ApiError extends Error {
    public code: string;
    public details?: Record<string, any>;
    public statusCode?: number;

    constructor(message: string, code: string, statusCode?: number, details?: Record<string, any>) {
        super(message);
        this.name = 'ApiError';
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
    }
}

export class NetworkError extends Error {
    constructor(message = 'Network connection failed') {
        super(message);
        this.name = 'NetworkError';
    }
}

export class AuthenticationError extends Error {
    constructor(message = 'Authentication failed') {
        super(message);
        this.name = 'AuthenticationError';
    }
}

export class ValidationError extends Error {
    public fields: Record<string, string[]>;

    constructor(message = 'Validation failed', fields: Record<string, string[]> = {}) {
        super(message);
        this.name = 'ValidationError';
        this.fields = fields;
    }
}

// Helper functions for common API operations
export const apiHelpers = {
    // Check if error is a specific type
    isApiError: (error: any): error is ApiError => error instanceof ApiError,
    isNetworkError: (error: any): error is NetworkError => error instanceof NetworkError,
    isAuthError: (error: any): error is AuthenticationError => error instanceof AuthenticationError,
    isValidationError: (error: any): error is ValidationError => error instanceof ValidationError,

    // Create error instances from API responses
    createErrorFromResponse: (response: any, statusCode?: number): Error => {
        if (response?.code && response?.message) {
            return new ApiError(response.message, response.code, statusCode, response.details);
        }

        if (statusCode === 401) {
            return new AuthenticationError(response?.message || 'Authentication failed');
        }

        if (statusCode === 422 && response?.errors) {
            return new ValidationError(response.message || 'Validation failed', response.errors);
        }

        return new Error(response?.message || 'An unexpected error occurred');
    },

    // Format API request/response for logging
    formatApiLog: (method: string, url: string, data?: any) => ({
        method: method.toUpperCase(),
        url,
        timestamp: new Date().toISOString(),
        data: data ? (typeof data === 'object' ? JSON.stringify(data) : data) : undefined,
    }),

    // Retry logic helper
    retryOperation: async <T> (
        operation: () => Promise<T>,
        maxRetries = 3,
        delay = 1000
    ): Promise<T> => {
        let lastError: Error;

        for (let i = 0; i <= maxRetries; i++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error as Error;

                if (i === maxRetries) break;

                // Don't retry on authentication or validation errors
                if (apiHelpers.isAuthError(error) || apiHelpers.isValidationError(error)) {
                    break;
                }

                await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
            }
        }

        throw lastError!;
    },
};

// Development utilities
export const devUtils = {
    // Enable/disable API logging
    enableApiLogging: (enabled = true) => {
        if (enabled && typeof window !== 'undefined') {
            (window as any).__YARDROVER_API_LOGGING__ = true;
        }
    },

    // Mock API responses for development
    mockApiResponse: <T> (data: T, delay = 1000): Promise<T> => {
        return new Promise(resolve => {
            setTimeout(() => resolve(data), delay);
        });
    },

    // Get API client for testing
    getApiClient: () => apiClient,
    getAuthClient: () => authClient,
};

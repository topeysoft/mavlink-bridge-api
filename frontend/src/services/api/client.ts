import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';

// API Configuration
export const API_CONFIG = {
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
    retryDelay: 1000, // 1 second
};

// Request/Response types
export interface ApiResponse<T = any> {
    data: T;
    message?: string;
    success: boolean;
    timestamp: string;
    requestId: string;
}

export interface ApiError {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    path: string;
    requestId: string;
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

export interface ApiRequestConfig extends AxiosRequestConfig {
    retry?: boolean;
    skipAuth?: boolean;
    skipErrorHandling?: boolean;
}

// Create main API client instance
export const createApiClient = (): AxiosInstance => {
    const client = axios.create({
        baseURL: API_CONFIG.baseURL,
        timeout: API_CONFIG.timeout,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
    });

    return client;
};

// Create authenticated API client
export const createAuthenticatedClient = (token?: string): AxiosInstance => {
    const client = createApiClient();

    if (token) {
        client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }

    return client;
};

// Utility functions
export const isApiError = (error: any): error is ApiError => {
    return error && typeof error === 'object' && 'code' in error && 'message' in error;
};

// TODO: Add DOM type support for FormData and URLSearchParams
// export const createFormData = (data: Record<string, any>): FormData => {
//   const formData = new FormData();
//   // Implementation here
// };

// export const buildQueryString = (params: Record<string, any>): string => {
//   const searchParams = new URLSearchParams();
//   // Implementation here
// };

// Export default API client
export const apiClient = createApiClient();

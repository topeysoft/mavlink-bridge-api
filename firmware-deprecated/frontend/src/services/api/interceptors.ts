import type { AxiosInstance, AxiosError, AxiosResponse } from 'axios';
import type { ApiError, ApiResponse } from './client';

// Token management
export class TokenManager {
    private static instance: TokenManager;
    private accessToken: string | null = null;
    private refreshToken: string | null = null;
    private tokenExpiryTime: number | null = null;

    static getInstance (): TokenManager {
        if (!TokenManager.instance) {
            TokenManager.instance = new TokenManager();
        }
        return TokenManager.instance;
    }

    setTokens (accessToken: string, refreshToken: string, expiresIn: number): void {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.tokenExpiryTime = Date.now() + (expiresIn * 1000);

        // Store in localStorage for persistence
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', refreshToken);
        localStorage.setItem('token_expiry', this.tokenExpiryTime.toString());
    }

    getAccessToken (): string | null {
        if (!this.accessToken) {
            this.accessToken = localStorage.getItem('access_token');
            const expiry = localStorage.getItem('token_expiry');
            this.tokenExpiryTime = expiry ? parseInt(expiry, 10) : null;
        }
        return this.accessToken;
    }

    getRefreshToken (): string | null {
        if (!this.refreshToken) {
            this.refreshToken = localStorage.getItem('refresh_token');
        }
        return this.refreshToken;
    }

    isTokenExpired (): boolean {
        if (!this.tokenExpiryTime) return true;
        return Date.now() >= this.tokenExpiryTime - 60000; // Refresh 1 minute before expiry
    }

    clearTokens (): void {
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiryTime = null;
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('token_expiry');
    }
}

// Request interceptor
export const setupRequestInterceptor = (client: AxiosInstance): void => {
    client.interceptors.request.use(
        (config) => {
            // Add request ID for tracing
            config.headers['X-Request-ID'] = crypto.randomUUID();

            // Add timestamp
            config.headers['X-Request-Time'] = new Date().toISOString();

            // Add authentication token if available
            const tokenManager = TokenManager.getInstance();
            const token = tokenManager.getAccessToken();

            if (token && !config.url?.includes('/auth/')) {
                config.headers.Authorization = `Bearer ${token}`;
            }

            // Log request in development
            if (import.meta.env.DEV) {
                console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`, {
                    params: config.params,
                    data: config.data,
                    headers: config.headers,
                });
            }

            return config;
        },
        (error) => {
            console.error('❌ Request Error:', error);
            return Promise.reject(error);
        }
    );
};

// Response interceptor
export const setupResponseInterceptor = (client: AxiosInstance): void => {
    client.interceptors.response.use(
        (response: AxiosResponse<ApiResponse>) => {
            // Log response in development
            if (import.meta.env.DEV) {
                console.log(`✅ API Response: ${response.config.method?.toUpperCase()} ${response.config.url}`, {
                    status: response.status,
                    data: response.data,
                    timing: response.headers['x-response-time'],
                });
            }

            // Return just the data from our API response wrapper
            return {
                ...response,
                data: response.data.data || response.data,
            };
        },
        async (error: AxiosError<ApiError>) => {
            const originalRequest = error.config;

            // Handle token expiration
            if (error.response?.status === 401 && originalRequest) {
                const tokenManager = TokenManager.getInstance();
                const refreshToken = tokenManager.getRefreshToken();

                if (refreshToken && !originalRequest.url?.includes('/auth/refresh')) {
                    try {
                        // Attempt to refresh token
                        const refreshResponse = await client.post('/auth/refresh', {
                            refreshToken,
                        });

                        const { accessToken, refreshToken: newRefreshToken, expiresIn } = refreshResponse.data;
                        tokenManager.setTokens(accessToken, newRefreshToken, expiresIn);

                        // Retry original request
                        if (originalRequest.headers) {
                            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                        }
                        return client(originalRequest);
                    } catch (refreshError) {
                        // Refresh failed, redirect to login
                        tokenManager.clearTokens();
                        window.location.href = '/login';
                        return Promise.reject(refreshError);
                    }
                } else {
                    // No refresh token available, redirect to login
                    tokenManager.clearTokens();
                    window.location.href = '/login';
                }
            }

            // Log error in development
            if (import.meta.env.DEV) {
                console.error(`❌ API Error: ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    data: error.response?.data,
                    message: error.message,
                });
            }

            // Transform error response
            const apiError: ApiError = {
                code: error.response?.data?.code || 'UNKNOWN_ERROR',
                message: error.response?.data?.message || error.message || 'An unexpected error occurred',
                details: error.response?.data?.details,
                timestamp: error.response?.data?.timestamp || new Date().toISOString(),
                path: error.config?.url || '',
                requestId: error.config?.headers?.['X-Request-ID'] || '',
            };

            return Promise.reject(apiError);
        }
    );
};

// Retry interceptor
export const setupRetryInterceptor = (client: AxiosInstance, maxRetries = 3): void => {
    client.interceptors.response.use(
        (response) => response,
        async (error: AxiosError) => {
            const { config } = error;

            if (!config) return Promise.reject(error);

            // Initialize retry count
            config['retryCount'] = config['retryCount'] || 0;

            // Check if we should retry
            const shouldRetry = (
                config['retryCount'] < maxRetries &&
                (error.response?.status === 0 || // Network error
                    error.response?.status === 408 || // Request timeout
                    error.response?.status === 429 || // Too many requests
                    (error.response?.status && error.response.status >= 500)) // Server errors
            );

            if (shouldRetry) {
                config['retryCount']++;

                // Exponential backoff delay
                const delay = Math.pow(2, config['retryCount']) * 1000;

                if (import.meta.env.DEV) {
                    console.log(`🔄 Retrying request (${config['retryCount']}/${maxRetries}) after ${delay}ms delay`);
                }

                await new Promise(resolve => setTimeout(resolve, delay));
                return client(config);
            }

            return Promise.reject(error);
        }
    );
};

// Setup all interceptors
export const setupInterceptors = (client: AxiosInstance): void => {
    setupRequestInterceptor(client);
    setupResponseInterceptor(client);
    setupRetryInterceptor(client);
};

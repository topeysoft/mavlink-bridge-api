/**
 * Token provider function type
 */
export type TokenProvider = () => string | null;

/**
 * Request options for HTTP methods
 */
export interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

/**
 * Diagnostic information about HTTP requests
 */
export interface HttpDiagnostics {
  baseUrl: string;
  reachable: boolean;
  responseTime?: number;
  statusCode?: number;
  error?: string;
}

/**
 * HTTP client for communicating with the ESP32 REST API
 */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly activeRequests = new Set<AbortController>();
  private tokenProvider: TokenProvider | null = null;

  constructor(baseUrl: string, timeout = 10000) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = timeout;
  }

  /**
   * Set token provider for automatic token injection
   */
  setTokenProvider(provider: TokenProvider): void {
    this.tokenProvider = provider;
  }

  /**
   * Clear token provider
   */
  clearTokenProvider(): void {
    this.tokenProvider = null;
  }

  /**
   * Perform a GET request
   */
  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  /**
   * Perform a POST request
   */
  async post<T>(path: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, data, options);
  }

  /**
   * Perform a PATCH request
   */
  async patch<T>(path: string, patch: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PATCH', path, patch, options);
  }

  /**
   * Perform a PUT request
   */
  async put<T>(path: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', path, data, options);
  }

  /**
   * Perform a DELETE request
   */
  async delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, undefined, options);
  }

  /**
   * Generic request method
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    path: string,
    data?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    
    const requestTimeout = options?.timeout || this.timeout;
    const controller = new AbortController();
    this.activeRequests.add(controller);
    
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, requestTimeout);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options?.headers,
      };

      // Inject auth token if available and not already provided
      if (this.tokenProvider && !headers['Authorization'] && !headers['authorization']) {
        const token = this.tokenProvider();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const config: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      };

      if (data !== undefined && method !== 'GET') {
        config.body = JSON.stringify(data);
      }

      const response = await fetch(url, config);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage: string;
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || 'HTTP request failed';
        } catch {
          // Handle common HTTP status codes with helpful messages
          switch (response.status) {
            case 401:
              errorMessage = `Authentication required (401) - Please log in`;
              break;
            case 403:
              errorMessage = `Access forbidden (403) - Insufficient permissions`;
              break;
            case 404:
              errorMessage = `Endpoint not found (404) - Check device firmware version or API compatibility`;
              break;
            case 500:
              errorMessage = `Server error (500) - Device may be experiencing issues`;
              break;
            case 503:
              errorMessage = `Service unavailable (503) - Device may be overloaded or starting up`;
              break;
            default:
              errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
          }
        }

        throw new HttpError(response.status, errorMessage);
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json() as T;
      }

      // If not JSON, return text as T (for cases where T is string)
      return await response.text() as unknown as T;

    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new HttpError(0, `Request timeout after ${requestTimeout}ms`);
        }
        
        // Enhanced error reporting for common network issues
        if (error.message.includes('ECONNREFUSED')) {
          throw new HttpError(0, `Connection refused - Device may be offline or unreachable`);
        }
        if (error.message.includes('ENOTFOUND')) {
          throw new HttpError(0, `Hostname not found - Check device URL or network connection`);
        }
        if (error.message.includes('ETIMEDOUT')) {
          throw new HttpError(0, `Connection timeout - Check network connectivity`);
        }
        if (error.message.includes('ECONNRESET')) {
          throw new HttpError(0, `Connection reset - Device may have restarted`);
        }
        if (error.message.includes('TypeError') && error.message.includes('fetch')) {
          throw new HttpError(0, `Network error - Unable to reach device at ${this.baseUrl}`);
        }
        
        // Check for CORS issues
        if (error.message.includes('CORS')) {
          throw new HttpError(0, `CORS error - Device may not allow requests from this origin`);
        }
        
        throw new HttpError(0, `HTTP request failed: ${error.message}`);
      }

      throw new HttpError(0, `Unknown error occurred while connecting to ${this.baseUrl}`);
    } finally {
      clearTimeout(timeoutId);
      this.activeRequests.delete(controller);
    }
  }

  /**
   * Get the base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Test connectivity to the device
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok || response.status === 404; // 404 is ok, means server is responding
    } catch {
      return false;
    }
  }
  
  /**
   * Abort all active requests
   */
  abortAllRequests(): void {
    for (const controller of this.activeRequests) {
      controller.abort();
    }
    this.activeRequests.clear();
  }
  
  /**
   * Get count of active requests
   */
  getActiveRequestCount(): number {
    return this.activeRequests.size;
  }
  
  /**
   * Get diagnostic information about the connection
   */
  async getDiagnostics(): Promise<{
    baseUrl: string;
    reachable: boolean;
    responseTime?: number;
    statusCode?: number;
    error?: string;
    activeRequests?: number;
  }> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(this.baseUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000)
      });
      
      return {
        baseUrl: this.baseUrl,
        reachable: true,
        responseTime: Date.now() - startTime,
        statusCode: response.status,
        activeRequests: this.activeRequests.size
      };
    } catch (error) {
      return {
        baseUrl: this.baseUrl,
        reachable: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        activeRequests: this.activeRequests.size
      };
    }
  }
}

/**
 * Custom error class for HTTP requests
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'HttpError';
  }

  /**
   * Check if error is a client error (4xx)
   */
  isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  /**
   * Check if error is a server error (5xx)
   */
  isServerError(): boolean {
    return this.status >= 500 && this.status < 600;
  }

  /**
   * Check if error is a network error (status 0)
   */
  isNetworkError(): boolean {
    return this.status === 0;
  }
  
  /**
   * Check if error is an authentication error (401)
   */
  isAuthError(): boolean {
    return this.status === 401;
  }

  /**
   * Check if error is a permission error (403)
   */
  isPermissionError(): boolean {
    return this.status === 403;
  }

  /**
   * Check if error is a timeout error
   */
  isTimeoutError(): boolean {
    return this.status === 0 && this.message.includes('timeout');
  }

  /**
   * Check if error suggests device is unreachable
   */
  isUnreachableError(): boolean {
    return this.status === 0 && (
      this.message.includes('Connection refused') ||
      this.message.includes('Hostname not found') ||
      this.message.includes('Network error')
    );
  }
  
  /**
   * Get a user-friendly description of the error
   */
  getUserFriendlyMessage(): string {
    if (this.isAuthError()) {
      return 'Authentication required - Please log in to continue';
    }
    if (this.isPermissionError()) {
      return 'Access forbidden - You do not have permission to perform this action';
    }
    if (this.isTimeoutError()) {
      return 'Request timed out - Device may be slow to respond or unreachable';
    }
    if (this.isUnreachableError()) {
      return 'Device is unreachable - Check network connection and device power';
    }
    if (this.isNetworkError()) {
      return 'Network error - Unable to connect to device';
    }
    if (this.status === 404) {
      return 'API endpoint not found - Check device firmware version';
    }
    if (this.status >= 500) {
      return 'Device error - The device encountered an internal error';
    }

    return this.message;
  }
}
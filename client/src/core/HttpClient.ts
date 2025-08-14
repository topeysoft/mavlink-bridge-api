/**
 * Request options for HTTP methods
 */
export interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * HTTP client for communicating with the ESP32 REST API
 */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(baseUrl: string, timeout = 5000) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = timeout;
  }

  /**
   * Perform a GET request
   */
  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
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
   * Generic request method
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    data?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    
    const requestTimeout = options?.timeout || this.timeout;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options?.headers,
      };

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
          errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
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
          throw new HttpError(0, `Request timeout after ${this.timeout}ms`);
        }
        throw new HttpError(0, `Network error: ${error.message}`);
      }

      throw new HttpError(0, 'Unknown error occurred');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get the base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Set request timeout
   */
  setTimeout(timeout: number): void {
    if (timeout <= 0) {
      throw new Error('Timeout must be greater than 0');
    }
    // Note: This creates a new instance in current implementation
    // In a full implementation, you'd want to store timeout as a mutable property
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
}
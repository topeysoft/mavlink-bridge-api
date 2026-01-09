/**
 * Authentication client for YardRover API
 */

import { HttpClient } from '../core/HttpClient';
import type {
  LoginRequest,
  LoginResponse,
  APIKeyCreateRequest,
  APIKeyCreateResponse,
  APIKeyListItem,
  CurrentUser,
  SetupStatus,
  CompleteSetupRequest,
  CompleteSetupResponse,
  Role,
  AuthState,
} from './AuthTypes';

/**
 * Storage key for auth token
 */
const AUTH_TOKEN_KEY = 'yardrover_auth_token';
const AUTH_EXPIRY_KEY = 'yardrover_auth_expiry';
const AUTH_ROLE_KEY = 'yardrover_auth_role';

/**
 * Auth client for managing authentication and API keys
 */
export class AuthClient {
  private http: HttpClient;
  private token: string | null = null;
  private expiresAt: number | null = null;
  private role: Role | null = null;

  constructor(baseUrl: string, timeout = 10000) {
    this.http = new HttpClient(baseUrl, timeout);
    this.loadTokenFromStorage();
  }

  /**
   * Load auth token from local storage
   */
  private loadTokenFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      const expiry = localStorage.getItem(AUTH_EXPIRY_KEY);
      const role = localStorage.getItem(AUTH_ROLE_KEY);

      if (token && expiry && role) {
        const expiresAt = parseInt(expiry, 10);

        // Check if token is expired
        if (Date.now() < expiresAt) {
          this.token = token;
          this.expiresAt = expiresAt;
          this.role = role as Role;
        } else {
          // Token expired, clear storage
          this.clearTokenFromStorage();
        }
      }
    } catch (error) {
      console.error('Failed to load auth token from storage:', error);
    }
  }

  /**
   * Save auth token to local storage
   */
  private saveTokenToStorage(token: string, expiresIn: number, role: Role): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      const expiresAt = Date.now() + expiresIn * 1000;
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      localStorage.setItem(AUTH_EXPIRY_KEY, expiresAt.toString());
      localStorage.setItem(AUTH_ROLE_KEY, role);
    } catch (error) {
      console.error('Failed to save auth token to storage:', error);
    }
  }

  /**
   * Clear auth token from local storage
   */
  private clearTokenFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_EXPIRY_KEY);
      localStorage.removeItem(AUTH_ROLE_KEY);
    } catch (error) {
      console.error('Failed to clear auth token from storage:', error);
    }
  }

  /**
   * Get current auth token for requests
   */
  getAuthToken(): string | null {
    // Check if token is expired
    if (this.token && this.expiresAt && Date.now() >= this.expiresAt) {
      this.logout();
      return null;
    }
    return this.token;
  }

  /**
   * Get current auth state
   */
  getAuthState(): AuthState {
    const token = this.getAuthToken();
    return {
      authenticated: token !== null,
      accessToken: token,
      expiresAt: this.expiresAt,
      role: this.role,
      permissions: [], // Will be populated from token or API
      user: null, // Will be populated from API
    };
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.getAuthToken() !== null;
  }

  /**
   * Check if token will expire soon (within 5 minutes)
   */
  willExpireSoon(): boolean {
    if (!this.expiresAt) return false;
    const fiveMinutes = 5 * 60 * 1000;
    return Date.now() >= this.expiresAt - fiveMinutes;
  }

  /**
   * Get time until token expires (in milliseconds)
   */
  getTimeUntilExpiry(): number | null {
    if (!this.expiresAt) return null;
    const remaining = this.expiresAt - Date.now();
    return remaining > 0 ? remaining : 0;
  }

  /**
   * Login with API key
   */
  async login(apiKey: string): Promise<LoginResponse> {
    const request: LoginRequest = { api_key: apiKey };
    const response = await this.http.post<LoginResponse>('/api/auth/login', request);

    // Store token
    this.token = response.access_token;
    this.expiresAt = Date.now() + response.expires_in * 1000;
    this.role = response.role;

    // Save to storage
    this.saveTokenToStorage(response.access_token, response.expires_in, response.role);

    return response;
  }

  /**
   * Logout (clear token)
   */
  logout(): void {
    this.token = null;
    this.expiresAt = null;
    this.role = null;
    this.clearTokenFromStorage();
  }

  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<CurrentUser> {
    const token = this.getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    return await this.http.get<CurrentUser>('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  /**
   * Create a new API key (admin only)
   */
  async createAPIKey(request: APIKeyCreateRequest): Promise<APIKeyCreateResponse> {
    const token = this.getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    return await this.http.post<APIKeyCreateResponse>('/api/auth/api-keys', request, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  /**
   * List all API keys (admin only)
   */
  async listAPIKeys(): Promise<APIKeyListItem[]> {
    const token = this.getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    return await this.http.get<APIKeyListItem[]>('/api/auth/api-keys', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  /**
   * Delete an API key (admin only)
   */
  async deleteAPIKey(keyId: string): Promise<{ message: string }> {
    const token = this.getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    return await this.http.delete<{ message: string }>(`/api/auth/api-keys/${keyId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  /**
   * Enable an API key (admin only)
   */
  async enableAPIKey(keyId: string): Promise<{ message: string }> {
    const token = this.getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    return await this.http.patch<{ message: string }>(
      `/api/auth/api-keys/${keyId}/enable`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  }

  /**
   * Revoke an API key (admin only)
   */
  async revokeAPIKey(keyId: string): Promise<{ message: string }> {
    const token = this.getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    return await this.http.patch<{ message: string }>(
      `/api/auth/api-keys/${keyId}/revoke`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  }

  /**
   * Update API key role (admin only)
   */
  async updateAPIKeyRole(keyId: string, role: Role): Promise<{ message: string }> {
    const token = this.getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    return await this.http.patch<{ message: string }>(
      `/api/auth/api-keys/${keyId}/role`,
      { role },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  }

  // Setup endpoints (no auth required)

  /**
   * Get setup status
   */
  async getSetupStatus(): Promise<SetupStatus> {
    return await this.http.get<SetupStatus>('/api/setup/status');
  }

  /**
   * Complete initial setup
   */
  async completeSetup(request: CompleteSetupRequest): Promise<CompleteSetupResponse> {
    return await this.http.post<CompleteSetupResponse>('/api/setup/complete', request);
  }

  /**
   * Reset setup (development/testing only)
   */
  async resetSetup(): Promise<{ message: string; warning: string }> {
    return await this.http.post<{ message: string; warning: string }>(
      '/api/setup/reset',
      {}
    );
  }
}

/**
 * Authentication client for YardRover API
 */

import { HttpClient } from '../core/HttpClient';
import type {
  LoginRequest,
  LoginResponse,
  UserLoginRequest,
  PinLoginRequest,
  RefreshTokenRequest,
  RefreshTokenResponse,
  LogoutRequest,
  APIKeyCreateRequest,
  APIKeyCreateResponse,
  APIKeyListItem,
  CurrentUser,
  SetupStatus,
  CompleteSetupRequest,
  CompleteSetupResponse,
  ChangePasswordRequest,
  SetPinRequest,
  SuccessResponse,
  Role,
  AuthState,
} from './AuthTypes';

/**
 * Storage keys for auth tokens
 */
const AUTH_ACCESS_TOKEN_KEY = 'yardrover_access_token';
const AUTH_ACCESS_EXPIRY_KEY = 'yardrover_access_expiry';
const AUTH_REFRESH_TOKEN_KEY = 'yardrover_refresh_token';
const AUTH_REFRESH_EXPIRY_KEY = 'yardrover_refresh_expiry';
const AUTH_ROLE_KEY = 'yardrover_auth_role';

/**
 * Callback for handling logout events
 * @param reason - The reason for logout ('manual', 'token_refresh_failed', 'token_expired')
 */
export type LogoutCallback = (reason: 'manual' | 'token_refresh_failed' | 'token_expired') => void;

/**
 * Auth client for managing authentication and API keys
 */
export class AuthClient {
  private http: HttpClient;
  private token: string | null = null; // Access token
  private refreshToken: string | null = null; // Refresh token
  private expiresAt: number | null = null; // Access token expiry
  private refreshExpiresAt: number | null = null; // Refresh token expiry
  private role: Role | null = null;
  private isRefreshing: boolean = false; // Prevent concurrent refresh calls
  private refreshPromise: Promise<void> | null = null; // Promise for ongoing refresh
  private onLogoutCallback: LogoutCallback | null = null; // Callback when logout occurs

  constructor(baseUrl: string, timeout = 10000) {
    this.http = new HttpClient(baseUrl, timeout);
    this.loadTokenFromStorage();

    // Set up automatic token injection
    this.http.setTokenProvider(() => this.token);

    // Set up automatic token refresh on 401 errors
    this.http.setUnauthorizedCallback(async () => {
      // Don't attempt refresh if we're already in a refresh cycle
      // This prevents infinite recursion when the refresh endpoint itself returns 401
      if (this.isRefreshing) {
        console.log('[AuthClient] Already refreshing, not attempting refresh again');
        return false;
      }

      // Only attempt refresh if we have a valid refresh token
      if (this.refreshToken && this.refreshExpiresAt && Date.now() < this.refreshExpiresAt) {
        try {
          console.log('[AuthClient] Received 401, attempting token refresh...');
          await this.refreshAccessToken();
          console.log('[AuthClient] Token refreshed successfully after 401');
          return true; // Refresh successful, retry the request
        } catch (error) {
          console.error('[AuthClient] Failed to refresh token on 401:', error);
          // Clear auth state on refresh failure and notify callback with reason
          this.clearLocalState('token_refresh_failed');
          return false; // Refresh failed, don't retry
        }
      }
      // No valid refresh token, clear auth state and notify callback
      console.log('[AuthClient] No valid refresh token available, clearing auth state');
      this.clearLocalState('token_expired');
      return false; // No valid refresh token, don't retry
    });
  }

  /**
   * Load auth tokens from local storage
   */
  private loadTokenFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      const accessToken = localStorage.getItem(AUTH_ACCESS_TOKEN_KEY);
      const accessExpiry = localStorage.getItem(AUTH_ACCESS_EXPIRY_KEY);
      const refreshToken = localStorage.getItem(AUTH_REFRESH_TOKEN_KEY);
      const refreshExpiry = localStorage.getItem(AUTH_REFRESH_EXPIRY_KEY);
      const role = localStorage.getItem(AUTH_ROLE_KEY);

      if (accessToken && accessExpiry && role) {
        const accessExpiresAt = parseInt(accessExpiry, 10);

        // Load access token even if expired (will trigger refresh if refresh token valid)
        this.token = accessToken;
        this.expiresAt = accessExpiresAt;
        this.role = role as Role;
      }

      if (refreshToken && refreshExpiry) {
        const refreshExpiresAt = parseInt(refreshExpiry, 10);

        // Check if refresh token is expired
        if (Date.now() < refreshExpiresAt) {
          this.refreshToken = refreshToken;
          this.refreshExpiresAt = refreshExpiresAt;
        } else {
          // Refresh token expired, clear everything
          this.clearTokenFromStorage();
        }
      }
    } catch (error) {
      console.error('Failed to load auth tokens from storage:', error);
    }
  }

  /**
   * Save auth tokens to local storage
   */
  private saveTokenToStorage(
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
    role: Role
  ): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      const accessExpiresAt = Date.now() + expiresIn * 1000;
      // Refresh token expires in 7 days (backend default)
      const refreshExpiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

      localStorage.setItem(AUTH_ACCESS_TOKEN_KEY, accessToken);
      localStorage.setItem(AUTH_ACCESS_EXPIRY_KEY, accessExpiresAt.toString());
      localStorage.setItem(AUTH_REFRESH_TOKEN_KEY, refreshToken);
      localStorage.setItem(AUTH_REFRESH_EXPIRY_KEY, refreshExpiresAt.toString());
      localStorage.setItem(AUTH_ROLE_KEY, role);
    } catch (error) {
      console.error('Failed to save auth tokens to storage:', error);
    }
  }

  /**
   * Clear auth tokens from local storage
   */
  private clearTokenFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      localStorage.removeItem(AUTH_ACCESS_TOKEN_KEY);
      localStorage.removeItem(AUTH_ACCESS_EXPIRY_KEY);
      localStorage.removeItem(AUTH_REFRESH_TOKEN_KEY);
      localStorage.removeItem(AUTH_REFRESH_EXPIRY_KEY);
      localStorage.removeItem(AUTH_ROLE_KEY);
    } catch (error) {
      console.error('Failed to clear auth tokens from storage:', error);
    }
  }

  /**
   * Get current auth token for requests (auto-refreshes if needed)
   */
  async getAuthToken(): Promise<string | null> {
    // If access token is expired but refresh token is valid, refresh
    if (this.token && this.expiresAt && Date.now() >= this.expiresAt) {
      if (this.refreshToken && this.refreshExpiresAt && Date.now() < this.refreshExpiresAt) {
        try {
          await this.refreshAccessToken();
          return this.token;
        } catch (error) {
          console.error('Failed to refresh access token:', error);
          this.logout();
          return null;
        }
      } else {
        // Refresh token also expired
        this.logout();
        return null;
      }
    }

    return this.token;
  }

  /**
   * Get current auth token synchronously (without auto-refresh)
   * Use this for immediate checks, but prefer getAuthToken() for actual requests
   */
  getAuthTokenSync(): string | null {
    return this.token;
  }

  /**
   * Get current auth state
   */
  getAuthState(): AuthState {
    return {
      authenticated: this.token !== null && this.refreshToken !== null,
      accessToken: this.token,
      refreshToken: this.refreshToken,
      expiresAt: this.expiresAt,
      refreshExpiresAt: this.refreshExpiresAt,
      role: this.role,
      permissions: [], // Will be populated from token or API
      user: null, // Will be populated from API
    };
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.token !== null && this.refreshToken !== null;
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
   * Set callback to be called when logout occurs
   */
  setLogoutCallback(callback: LogoutCallback): void {
    this.onLogoutCallback = callback;
  }

  /**
   * Clear logout callback
   */
  clearLogoutCallback(): void {
    this.onLogoutCallback = null;
  }

  /**
   * Login with API key
   */
  async login(apiKey: string): Promise<LoginResponse> {
    const request: LoginRequest = { api_key: apiKey };
    const response = await this.http.post<LoginResponse>('/api/auth/login', request);

    // Store tokens
    this.token = response.access_token;
    this.refreshToken = response.refresh_token;
    this.expiresAt = Date.now() + response.expires_in * 1000;
    this.refreshExpiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    this.role = response.role;

    // Save to storage
    this.saveTokenToStorage(
      response.access_token,
      response.refresh_token,
      response.expires_in,
      response.role
    );

    return response;
  }

  /**
   * Login with username and password
   */
  async loginWithPassword(username: string, password: string): Promise<LoginResponse> {
    const request: UserLoginRequest = { username, password };
    const response = await this.http.post<LoginResponse>('/api/auth/login/password', request);

    // Store tokens
    this.token = response.access_token;
    this.refreshToken = response.refresh_token;
    this.expiresAt = Date.now() + response.expires_in * 1000;
    this.refreshExpiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    this.role = response.role;

    // Save to storage
    this.saveTokenToStorage(
      response.access_token,
      response.refresh_token,
      response.expires_in,
      response.role
    );

    return response;
  }

  /**
   * Login with PIN
   */
  async loginWithPin(pin: string): Promise<LoginResponse> {
    const request: PinLoginRequest = { pin };
    const response = await this.http.post<LoginResponse>('/api/auth/login/pin', request);

    // Store tokens
    this.token = response.access_token;
    this.refreshToken = response.refresh_token;
    this.expiresAt = Date.now() + response.expires_in * 1000;
    this.refreshExpiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    this.role = response.role;

    // Save to storage
    this.saveTokenToStorage(
      response.access_token,
      response.refresh_token,
      response.expires_in,
      response.role
    );

    return response;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<void> {
    // Prevent concurrent refresh calls
    if (this.isRefreshing && this.refreshPromise) {
      await this.refreshPromise;
      return;
    }

    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    this.isRefreshing = true;
    this.refreshPromise = (async () => {
      try {
        const request: RefreshTokenRequest = { refresh_token: this.refreshToken! };
        const response = await this.http.post<RefreshTokenResponse>('/api/auth/refresh', request);

        // Update access token (refresh token stays the same)
        this.token = response.access_token;
        this.expiresAt = Date.now() + response.expires_in * 1000;

        // Update storage with new access token
        if (this.refreshToken && this.role) {
          this.saveTokenToStorage(
            response.access_token,
            this.refreshToken,
            response.expires_in,
            this.role
          );
        }
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    })();

    await this.refreshPromise;
  }

  /**
   * Clear local auth state and notify callback (used by unauthorized callback)
   * Does NOT revoke tokens on server (they're already invalid)
   */
  private clearLocalState(reason: 'token_refresh_failed' | 'token_expired'): void {
    console.log('[AuthClient] clearLocalState called, reason:', reason);

    // Clear local state
    this.token = null;
    this.refreshToken = null;
    this.expiresAt = null;
    this.refreshExpiresAt = null;
    this.role = null;
    this.clearTokenFromStorage();
    console.log('[AuthClient] Local state cleared');

    // Notify callback if registered
    if (this.onLogoutCallback) {
      console.log('[AuthClient] Calling logout callback with reason:', reason);
      this.onLogoutCallback(reason);
    }
  }

  /**
   * Logout (revoke refresh token and clear local state)
   */
  async logout(): Promise<void> {
    console.log('[AuthClient] logout called, refreshToken:', this.refreshToken ? 'present' : 'null');

    // If we have a refresh token, revoke it on the server
    if (this.refreshToken) {
      try {
        console.log('[AuthClient] Calling /api/auth/logout to revoke refresh token');
        const request: LogoutRequest = { refresh_token: this.refreshToken };
        await this.http.post('/api/auth/logout', request, {
          headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
        });
        console.log('[AuthClient] Refresh token revoked successfully');
      } catch (error) {
        console.error('[AuthClient] Failed to revoke refresh token:', error);
        // Continue with local logout even if server call fails
      }
    } else {
      console.log('[AuthClient] No refresh token to revoke, skipping server logout call');
    }

    // Clear local state
    this.token = null;
    this.refreshToken = null;
    this.expiresAt = null;
    this.refreshExpiresAt = null;
    this.role = null;
    this.clearTokenFromStorage();
    console.log('[AuthClient] Local state cleared');

    // Notify callback if registered (manual logout)
    if (this.onLogoutCallback) {
      console.log('[AuthClient] Calling logout callback with reason: manual');
      this.onLogoutCallback('manual');
    }
  }

  /**
   * Logout from all devices (revoke all refresh tokens for this user)
   */
  async logoutAll(): Promise<void> {
    try {
      if (this.token) {
        await this.http.post('/api/auth/logout/all', {}, {
          headers: { Authorization: `Bearer ${this.token}` },
        });
      }
    } catch (error) {
      console.error('Failed to logout from all devices:', error);
    }

    // Clear local state
    this.token = null;
    this.refreshToken = null;
    this.expiresAt = null;
    this.refreshExpiresAt = null;
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

  /**
   * Change password (authenticated users only)
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<SuccessResponse> {
    const token = this.getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const request: ChangePasswordRequest = {
      old_password: oldPassword,
      new_password: newPassword,
    };

    return await this.http.post<SuccessResponse>('/api/auth/password/change', request, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  /**
   * Set or update PIN (authenticated users only)
   */
  async setPin(pin: string, password: string): Promise<SuccessResponse> {
    const token = this.getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const request: SetPinRequest = { pin, password };

    return await this.http.post<SuccessResponse>('/api/auth/pin/set', request, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  /**
   * Remove PIN (authenticated users only)
   */
  async removePin(password: string): Promise<SuccessResponse> {
    const token = this.getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    return await this.http.delete<SuccessResponse>(`/api/auth/pin?password=${encodeURIComponent(password)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
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

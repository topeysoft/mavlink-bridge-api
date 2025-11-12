import type { AxiosInstance } from 'axios';
import { apiClient } from '../api/client';
import { TokenManager } from '../api/interceptors';
import type {
    User,
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    PasswordResetRequest,
    PasswordChangeRequest,
    UserUpdateRequest,
    TwoFactorSetup,
    ApiKey,
    UserSession
} from '../types/user.types';
import type { ApiResponse } from '../api/client';

export class AuthService {
    private client: AxiosInstance;
    private tokenManager: TokenManager;

    constructor(client: AxiosInstance = apiClient) {
        this.client = client;
        this.tokenManager = TokenManager.getInstance();
    }

    // Authentication Methods
    async login (credentials: LoginRequest): Promise<LoginResponse> {
        const response = await this.client.post<ApiResponse<LoginResponse>>('/auth/login', credentials);
        const loginData = response.data.data || response.data;

        // Store tokens
        this.tokenManager.setTokens(
            loginData.tokens.accessToken,
            loginData.tokens.refreshToken,
            loginData.tokens.expiresIn
        );

        return loginData;
    }

    async register (userData: RegisterRequest): Promise<LoginResponse> {
        const response = await this.client.post<ApiResponse<LoginResponse>>('/auth/register', userData);
        const loginData = response.data.data || response.data;

        // Store tokens
        this.tokenManager.setTokens(
            loginData.tokens.accessToken,
            loginData.tokens.refreshToken,
            loginData.tokens.expiresIn
        );

        return loginData;
    }

    async logout (): Promise<void> {
        try {
            const refreshToken = this.tokenManager.getRefreshToken();
            if (refreshToken) {
                await this.client.post('/auth/logout', { refreshToken });
            }
        } catch (error) {
            // Continue with logout even if API call fails
            console.warn('Logout API call failed:', error);
        } finally {
            this.tokenManager.clearTokens();
        }
    }

    async refreshToken (): Promise<void> {
        const refreshToken = this.tokenManager.getRefreshToken();
        if (!refreshToken) {
            throw new Error('No refresh token available');
        }

        const response = await this.client.post<ApiResponse<{
            accessToken: string;
            refreshToken: string;
            expiresIn: number;
        }>>('/auth/refresh', { refreshToken });

        const tokenData = response.data.data || response.data;
        this.tokenManager.setTokens(
            tokenData.accessToken,
            tokenData.refreshToken,
            tokenData.expiresIn
        );
    }

    async getCurrentUser (): Promise<User> {
        const response = await this.client.get<ApiResponse<User>>('/auth/me');
        return response.data.data || response.data;
    }

    async verifyEmail (token: string): Promise<void> {
        await this.client.post('/auth/verify-email', { token });
    }

    async resendVerificationEmail (): Promise<void> {
        await this.client.post('/auth/resend-verification');
    }

    // Password Management
    async requestPasswordReset (data: PasswordResetRequest): Promise<void> {
        await this.client.post('/auth/password-reset', data);
    }

    async resetPassword (token: string, newPassword: string): Promise<void> {
        await this.client.post('/auth/password-reset/confirm', {
            token,
            password: newPassword,
        });
    }

    async changePassword (data: PasswordChangeRequest): Promise<void> {
        await this.client.post('/auth/password-change', data);
    }

    // Two-Factor Authentication
    async setupTwoFactor (method: 'sms' | 'email' | 'app' = 'app'): Promise<TwoFactorSetup> {
        const response = await this.client.post<ApiResponse<TwoFactorSetup>>('/auth/2fa/setup', { method });
        return response.data.data || response.data;
    }

    async enableTwoFactor (code: string): Promise<{ backupCodes: string[] }> {
        const response = await this.client.post<ApiResponse<{ backupCodes: string[] }>>('/auth/2fa/enable', { code });
        return response.data.data || response.data;
    }

    async disableTwoFactor (code: string): Promise<void> {
        await this.client.post('/auth/2fa/disable', { code });
    }

    async verifyTwoFactor (code: string): Promise<void> {
        await this.client.post('/auth/2fa/verify', { code });
    }

    async generateBackupCodes (): Promise<{ backupCodes: string[] }> {
        const response = await this.client.post<ApiResponse<{ backupCodes: string[] }>>('/auth/2fa/backup-codes');
        return response.data.data || response.data;
    }

    // Session Management
    async getSessions (): Promise<UserSession[]> {
        const response = await this.client.get<ApiResponse<UserSession[]>>('/auth/sessions');
        return response.data.data || response.data;
    }

    async revokeSession (sessionId: string): Promise<void> {
        await this.client.delete(`/auth/sessions/${sessionId}`);
    }

    async revokeAllSessions (): Promise<void> {
        await this.client.delete('/auth/sessions');
    }

    // API Key Management
    async getApiKeys (): Promise<ApiKey[]> {
        const response = await this.client.get<ApiResponse<ApiKey[]>>('/auth/api-keys');
        return response.data.data || response.data;
    }

    async createApiKey (name: string, permissions: string[]): Promise<ApiKey> {
        const response = await this.client.post<ApiResponse<ApiKey>>('/auth/api-keys', {
            name,
            permissions,
        });
        return response.data.data || response.data;
    }

    async revokeApiKey (keyId: string): Promise<void> {
        await this.client.delete(`/auth/api-keys/${keyId}`);
    }

    // Utility Methods
    isLoggedIn (): boolean {
        const token = this.tokenManager.getAccessToken();
        return !!token && !this.tokenManager.isTokenExpired();
    }

    getAccessToken (): string | null {
        return this.tokenManager.getAccessToken();
    }

    async checkTokenExpiry (): Promise<boolean> {
        if (this.tokenManager.isTokenExpired()) {
            try {
                await this.refreshToken();
                return true;
            } catch (error) {
                this.tokenManager.clearTokens();
                return false;
            }
        }
        return true;
    }
}

// User Profile Service
export class UserService {
    private client: AxiosInstance;

    constructor(client: AxiosInstance = apiClient) {
        this.client = client;
    }

    async updateProfile (updates: UserUpdateRequest): Promise<User> {
        const response = await this.client.put<ApiResponse<User>>('/users/profile', updates);
        return response.data.data || response.data;
    }

    async uploadAvatar (file: File): Promise<{ avatarUrl: string }> {
        const formData = new FormData();
        formData.append('avatar', file);

        const response = await this.client.post<ApiResponse<{ avatarUrl: string }>>(
            '/users/avatar',
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }
        );
        return response.data.data || response.data;
    }

    async deleteAccount (): Promise<void> {
        await this.client.delete('/users/profile');
    }

    async exportData (): Promise<Blob> {
        const response = await this.client.get('/users/export', {
            responseType: 'blob',
        });
        return response.data;
    }

    async getNotificationSettings (): Promise<User['preferences']['notifications']> {
        const response = await this.client.get<ApiResponse<User['preferences']['notifications']>>('/users/notifications');
        return response.data.data || response.data;
    }

    async updateNotificationSettings (settings: Partial<User['preferences']['notifications']>): Promise<void> {
        await this.client.put('/users/notifications', settings);
    }

    async getPrivacySettings (): Promise<User['preferences']['privacy']> {
        const response = await this.client.get<ApiResponse<User['preferences']['privacy']>>('/users/privacy');
        return response.data.data || response.data;
    }

    async updatePrivacySettings (settings: Partial<User['preferences']['privacy']>): Promise<void> {
        await this.client.put('/users/privacy', settings);
    }
}

// Export singleton instances
export const authService = new AuthService();
export const userService = new UserService();

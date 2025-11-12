// User-related TypeScript interfaces
export interface User {
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    phone?: string;
    timezone: string;
    language: 'en' | 'es' | 'fr' | 'de' | 'it';
    role: 'user' | 'admin' | 'technician';
    status: 'active' | 'inactive' | 'suspended';
    emailVerified: boolean;
    phoneVerified: boolean;
    twoFactorEnabled: boolean;
    createdAt: string;
    updatedAt: string;
    lastLoginAt?: string;
    preferences: UserPreferences;
    subscription?: UserSubscription;
}

export interface UserPreferences {
    notifications: {
        email: boolean;
        push: boolean;
        sms: boolean;
        taskCompleted: boolean;
        batteryLow: boolean;
        maintenance: boolean;
        weather: boolean;
        errors: boolean;
    };
    dashboard: {
        defaultView: 'map' | 'status' | 'tasks' | 'analytics';
        refreshInterval: number; // seconds
        showWeather: boolean;
        showBattery: boolean;
        showLocation: boolean;
    };
    privacy: {
        shareLocation: boolean;
        shareUsageData: boolean;
        allowAnalytics: boolean;
    };
    accessibility: {
        highContrast: boolean;
        largeText: boolean;
        reduceMotion: boolean;
        screenReader: boolean;
    };
}

export interface UserSubscription {
    plan: 'basic' | 'premium' | 'professional';
    status: 'active' | 'cancelled' | 'expired' | 'trial';
    startDate: string;
    endDate: string;
    autoRenew: boolean;
    features: string[];
    maxMachines: number;
    maxYards: number;
    cloudStorage: number; // GB
}

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    tokenType: 'Bearer';
    expiresIn: number; // seconds
    scope: string[];
}

export interface LoginRequest {
    email: string;
    password: string;
    rememberMe?: boolean;
    deviceInfo?: {
        userAgent: string;
        platform: string;
        deviceId: string;
    };
}

export interface LoginResponse {
    user: User;
    tokens: AuthTokens;
    firstLogin: boolean;
    requiresPasswordChange: boolean;
    twoFactorRequired: boolean;
}

export interface RegisterRequest {
    email: string;
    password: string;
    confirmPassword: string;
    firstName: string;
    lastName: string;
    phone?: string;
    timezone: string;
    language: string;
    acceptTerms: boolean;
    marketingConsent?: boolean;
}

export interface PasswordResetRequest {
    email: string;
    redirectUrl?: string;
}

export interface PasswordChangeRequest {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}

export interface UserUpdateRequest {
    firstName?: string;
    lastName?: string;
    phone?: string;
    timezone?: string;
    language?: string;
    avatar?: File | string;
}

export interface TwoFactorSetup {
    enabled: boolean;
    method: 'sms' | 'email' | 'app';
    backupCodes?: string[];
    qrCode?: string; // for app-based 2FA
}

export interface ApiKey {
    id: string;
    name: string;
    key: string; // only returned on creation
    permissions: string[];
    lastUsed?: string;
    expiresAt?: string;
    createdAt: string;
    status: 'active' | 'revoked';
}

export interface UserSession {
    id: string;
    deviceInfo: {
        userAgent: string;
        platform: string;
        deviceId: string;
        location?: string;
    };
    ipAddress: string;
    createdAt: string;
    lastActivity: string;
    current: boolean;
}

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { authService, userService } from '@/services';
import type { User, ApiState, UserPreferences } from './types';
import type { LoginRequest, RegisterRequest } from '@/services/types/user.types';

export const useAuthStore = defineStore('auth', () => {
    // State
    const user = ref<User | null>(null);
    const isAuthenticated = ref(false);
    const apiState = ref<ApiState>({
        loading: 'idle',
        error: null,
        lastUpdated: null,
    });
    const sessionTimeout = ref<number | null>(null);
    const rememberMe = ref(false);

    // Getters
    const isLoggedIn = computed(() => isAuthenticated.value && user.value !== null);
    const userName = computed(() => {
        if (!user.value) return '';
        return `${user.value.firstName} ${user.value.lastName}`;
    });
    const userRole = computed(() => user.value?.role || 'user');
    const isAdmin = computed(() => userRole.value === 'admin');
    const userAvatar = computed(() => user.value?.avatar || '');
    const userEmail = computed(() => user.value?.email || '');
    const userPreferences = computed(() => user.value?.preferences);
    const isLoading = computed(() => apiState.value.loading === 'loading');
    const hasError = computed(() => apiState.value.error !== null);

    // Actions
    const setLoading = (loading: boolean) => {
        apiState.value.loading = loading ? 'loading' : 'idle';
    };

    const setError = (error: string | null) => {
        apiState.value.error = error;
        if (error) {
            apiState.value.loading = 'error';
        }
    };

    const clearError = () => {
        apiState.value.error = null;
    };

    const setUser = (userData: User) => {
        user.value = userData;
        isAuthenticated.value = true;
        apiState.value.lastUpdated = new Date().toISOString();
    };

    const clearUser = () => {
        user.value = null;
        isAuthenticated.value = false;
        sessionTimeout.value = null;
    };

    const login = async (credentials: LoginRequest) => {
        try {
            setLoading(true);
            clearError();

            const response = await authService.login(credentials);
            setUser(response.user);
            rememberMe.value = credentials.rememberMe || false;

            // Set session timeout if provided
            if (response.tokens.expiresIn) {
                sessionTimeout.value = Date.now() + (response.tokens.expiresIn * 1000);
            }

            apiState.value.loading = 'success';
            return response;
        } catch (error: any) {
            setError(error.message || 'Login failed');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const register = async (userData: RegisterRequest) => {
        try {
            setLoading(true);
            clearError();

            const response = await authService.register(userData);
            setUser(response.user);

            apiState.value.loading = 'success';
            return response;
        } catch (error: any) {
            setError(error.message || 'Registration failed');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        try {
            setLoading(true);
            await authService.logout();
        } catch (error) {
            // Continue with logout even if API call fails
            console.warn('Logout API call failed:', error);
        } finally {
            clearUser();
            setLoading(false);

            // Redirect to login page
            if (typeof window !== 'undefined') {
                window.location.href = '/login';
            }
        }
    };

    const refreshUser = async () => {
        try {
            setLoading(true);
            clearError();

            const userData = await authService.getCurrentUser();
            setUser(userData);

            apiState.value.loading = 'success';
            return userData;
        } catch (error: any) {
            setError(error.message || 'Failed to refresh user data');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const updateProfile = async (updates: Partial<User>) => {
        if (!user.value) {
            throw new Error('No user logged in');
        }

        try {
            setLoading(true);
            clearError();

            const updatedUser = await userService.updateProfile(updates);
            setUser(updatedUser);

            apiState.value.loading = 'success';
            return updatedUser;
        } catch (error: any) {
            setError(error.message || 'Failed to update profile');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const updatePreferences = async (preferences: Partial<UserPreferences>) => {
        if (!user.value) {
            throw new Error('No user logged in');
        }

        try {
            setLoading(true);
            clearError();

            // Update local state immediately for better UX
            user.value.preferences = {
                ...user.value.preferences,
                ...preferences,
            };

            // Update on server
            await userService.updateNotificationSettings(preferences.notifications || {});
            await userService.updatePrivacySettings(preferences.dashboard || {});

            apiState.value.loading = 'success';
        } catch (error: any) {
            setError(error.message || 'Failed to update preferences');
            // Revert local changes on error
            await refreshUser();
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const changePassword = async (currentPassword: string, newPassword: string) => {
        try {
            setLoading(true);
            clearError();

            await authService.changePassword({
                currentPassword,
                newPassword,
                confirmPassword: newPassword,
            });

            apiState.value.loading = 'success';
        } catch (error: any) {
            setError(error.message || 'Failed to change password');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const requestPasswordReset = async (email: string) => {
        try {
            setLoading(true);
            clearError();

            await authService.requestPasswordReset({ email });
            apiState.value.loading = 'success';
        } catch (error: any) {
            setError(error.message || 'Failed to request password reset');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const verifyEmail = async (token: string) => {
        try {
            setLoading(true);
            clearError();

            await authService.verifyEmail(token);

            // Refresh user data to get updated verification status
            await refreshUser();

            apiState.value.loading = 'success';
        } catch (error: any) {
            setError(error.message || 'Failed to verify email');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const checkTokenExpiry = async () => {
        if (sessionTimeout.value && Date.now() >= sessionTimeout.value) {
            await logout();
            return false;
        }

        try {
            const isValid = await authService.checkTokenExpiry();
            if (!isValid) {
                await logout();
                return false;
            }
            return true;
        } catch (error) {
            await logout();
            return false;
        }
    };

    const initializeAuth = async () => {
        try {
            // Check if user is already logged in
            if (authService.isLoggedIn()) {
                const userData = await authService.getCurrentUser();
                setUser(userData);
                return true;
            }
        } catch (error) {
            console.warn('Failed to initialize auth:', error);
            clearUser();
        }
        return false;
    };

    // Reset store state
    const $reset = () => {
        clearUser();
        apiState.value = {
            loading: 'idle',
            error: null,
            lastUpdated: null,
        };
        rememberMe.value = false;
    };

    return {
        // State
        user: computed(() => user.value),
        isAuthenticated: computed(() => isAuthenticated.value),
        apiState: computed(() => apiState.value),
        sessionTimeout: computed(() => sessionTimeout.value),
        rememberMe: computed(() => rememberMe.value),

        // Getters
        isLoggedIn,
        userName,
        userRole,
        isAdmin,
        userAvatar,
        userEmail,
        userPreferences,
        isLoading,
        hasError,

        // Actions
        login,
        register,
        logout,
        refreshUser,
        updateProfile,
        updatePreferences,
        changePassword,
        requestPasswordReset,
        verifyEmail,
        checkTokenExpiry,
        initializeAuth,
        clearError,
        $reset,
    };
}, {
    persist: {
        key: 'yardrover-auth',
        storage: localStorage,
        paths: ['user', 'isAuthenticated', 'rememberMe', 'sessionTimeout'],
    },
});

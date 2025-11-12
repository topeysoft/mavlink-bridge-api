import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { LocalStorage } from 'quasar';

interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
  permissions: string[];
}

interface LoginCredentials {
  username: string;
  password: string;
}

export const useUserStore = defineStore('user', () => {
  // State
  const user = ref<User | null>(null);
  const token = ref<string | null>(null);
  const isLoading = ref(false);
  const lastActivity = ref<Date>(new Date());

  // Load from local storage on init
  const savedToken = LocalStorage.getItem('auth_token') as string | null;
  const savedUser = LocalStorage.getItem('auth_user') as User | null;
  if (savedToken && savedUser) {
    token.value = savedToken;
    user.value = savedUser;
  }

  // Computed
  const isAuthenticated = computed(() => !!token.value && !!user.value);
  const userRole = computed(() => user.value?.role || 'viewer');
  const userName = computed(() => user.value?.username || 'Guest');

  // Actions
  async function login(credentials: LoginCredentials) {
    isLoading.value = true;
    try {
      // In production, this would call the API
      // For now, simulate authentication
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Simulate successful login
      const mockUser: User = {
        id: '1',
        username: credentials.username,
        email: `${credentials.username}@yardrover.local`,
        role: credentials.username === 'admin' ? 'admin' : 'operator',
        permissions: credentials.username === 'admin' 
          ? ['all']
          : ['view', 'control', 'tasks']
      };

      user.value = mockUser;
      token.value = btoa(`${credentials.username}:${Date.now()}`);

      // Save to local storage
      LocalStorage.set('auth_token', token.value);
      LocalStorage.set('auth_user', user.value);

      updateActivity();
      return { success: true };
    } catch (error) {
      console.error('Login failed:', error);
      return { 
        success: false, 
        error: 'Invalid credentials' 
      };
    } finally {
      isLoading.value = false;
    }
  }

  function logout() {
    user.value = null;
    token.value = null;
    LocalStorage.remove('auth_token');
    LocalStorage.remove('auth_user');
  }

  function updateActivity() {
    lastActivity.value = new Date();
  }

  function hasPermission(permission: string): boolean {
    if (!user.value) return false;
    return user.value.permissions.includes('all') || 
           user.value.permissions.includes(permission);
  }

  async function checkPermission(permission: string): Promise<boolean> {
    return hasPermission(permission);
  }

  // Auto logout after 30 minutes of inactivity
  setInterval(() => {
    if (isAuthenticated.value) {
      const now = new Date();
      const diff = now.getTime() - lastActivity.value.getTime();
      const thirtyMinutes = 30 * 60 * 1000;
      
      if (diff > thirtyMinutes) {
        logout();
      }
    }
  }, 60000); // Check every minute

  return {
    // State
    user,
    token,
    isLoading,
    lastActivity,

    // Computed
    isAuthenticated,
    userRole,
    userName,

    // Actions
    login,
    logout,
    updateActivity,
    hasPermission,
    checkPermission
  };
});
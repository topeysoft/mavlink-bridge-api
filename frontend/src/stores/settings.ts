import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { Settings, NotificationSettings, ApiState } from './types';

export const useSettingsStore = defineStore('settings', () => {
    // State
    const settings = ref<Settings>({
        user: {
            theme: 'auto',
            language: 'en',
            timezone: 'UTC',
            dateFormat: 'MM/dd/yyyy',
            timeFormat: '12h',
            temperatureUnit: 'celsius',
            distanceUnit: 'metric',
        },
        notifications: {
            email: {
                enabled: true,
                taskComplete: true,
                taskFailed: true,
                batteryLow: true,
                maintenanceReminder: true,
                weatherAlert: true,
                securityAlert: true,
            },
            push: {
                enabled: true,
                taskComplete: true,
                taskFailed: true,
                batteryLow: true,
                maintenanceReminder: false,
                weatherAlert: true,
                securityAlert: true,
            },
            inApp: {
                enabled: true,
                taskComplete: true,
                taskFailed: true,
                batteryLow: true,
                maintenanceReminder: true,
                weatherAlert: true,
                securityAlert: true,
            },
        },
        machine: {
            autoReturnToCharger: true,
            autoStartAfterCharge: false,
            rainSensorEnabled: true,
            collisionSensorSensitivity: 'medium',
            cuttingHeight: 50, // mm
            cuttingPattern: 'random',
            edgeMode: 'always',
            spiralMode: false,
            gpsAccuracy: 'high',
        },
        yard: {
            defaultMowingSchedule: {
                monday: { enabled: true, startTime: '09:00', duration: 120 },
                tuesday: { enabled: true, startTime: '09:00', duration: 120 },
                wednesday: { enabled: true, startTime: '09:00', duration: 120 },
                thursday: { enabled: true, startTime: '09:00', duration: 120 },
                friday: { enabled: true, startTime: '09:00', duration: 120 },
                saturday: { enabled: false, startTime: '10:00', duration: 90 },
                sunday: { enabled: false, startTime: '10:00', duration: 90 },
            },
            weatherIntegration: true,
            rainDelay: 24, // hours
            seasonalAdjustments: true,
            autoZoneDetection: true,
        },
        security: {
            pinRequired: true,
            pinCode: '',
            tiltAlarm: true,
            liftAlarm: true,
            geofenceAlerts: true,
            unauthorizedAccessAlert: true,
            nightMode: false,
        },
        maintenance: {
            autoReminders: true,
            bladeReplacementInterval: 90, // days
            cleaningReminder: 7, // days
            winterStorageReminder: true,
            serviceNotifications: true,
        },
    });

    const apiState = ref<ApiState>({
        loading: 'idle',
        error: null,
        lastUpdated: null,
    });

    // Getters
    const currentTheme = computed(() => {
        if (settings.value.user.theme === 'auto') {
            // In a real app, you'd check system preference
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return settings.value.user.theme;
    });

    const notificationSettings = computed(() => settings.value.notifications);

    const machineSettings = computed(() => settings.value.machine);

    const yardSettings = computed(() => settings.value.yard);

    const securitySettings = computed(() => settings.value.security);

    const maintenanceSettings = computed(() => settings.value.maintenance);

    const userPreferences = computed(() => settings.value.user);

    const isLoading = computed(() => apiState.value.loading === 'loading');
    const hasError = computed(() => apiState.value.error !== null);

    const enabledNotificationTypes = computed(() => {
        const types: string[] = [];
        if (settings.value.notifications.email.enabled) types.push('email');
        if (settings.value.notifications.push.enabled) types.push('push');
        if (settings.value.notifications.inApp.enabled) types.push('inApp');
        return types;
    });

    const securityFeatures = computed(() => {
        const features: string[] = [];
        if (settings.value.security.pinRequired) features.push('pin');
        if (settings.value.security.tiltAlarm) features.push('tilt');
        if (settings.value.security.liftAlarm) features.push('lift');
        if (settings.value.security.geofenceAlerts) features.push('geofence');
        return features;
    });

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

    const updateSettings = (newSettings: Partial<Settings>) => {
        settings.value = { ...settings.value, ...newSettings };
        apiState.value.lastUpdated = new Date().toISOString();
    };

    const updateUserSettings = (userSettings: Partial<Settings['user']>) => {
        settings.value.user = { ...settings.value.user, ...userSettings };
        apiState.value.lastUpdated = new Date().toISOString();
    };

    const updateNotificationSettings = (notifSettings: Partial<NotificationSettings>) => {
        settings.value.notifications = { ...settings.value.notifications, ...notifSettings };
        apiState.value.lastUpdated = new Date().toISOString();
    };

    const updateMachineSettings = (machineSettings: Partial<Settings['machine']>) => {
        settings.value.machine = { ...settings.value.machine, ...machineSettings };
        apiState.value.lastUpdated = new Date().toISOString();
    };

    const updateYardSettings = (yardSettings: Partial<Settings['yard']>) => {
        settings.value.yard = { ...settings.value.yard, ...yardSettings };
        apiState.value.lastUpdated = new Date().toISOString();
    };

    const updateSecuritySettings = (securitySettings: Partial<Settings['security']>) => {
        settings.value.security = { ...settings.value.security, ...securitySettings };
        apiState.value.lastUpdated = new Date().toISOString();
    };

    const updateMaintenanceSettings = (maintenanceSettings: Partial<Settings['maintenance']>) => {
        settings.value.maintenance = { ...settings.value.maintenance, ...maintenanceSettings };
        apiState.value.lastUpdated = new Date().toISOString();
    };

    const toggleNotification = (type: 'email' | 'push' | 'inApp', setting: string, enabled: boolean) => {
        if (settings.value.notifications[type] && setting in settings.value.notifications[type]) {
            (settings.value.notifications[type] as any)[setting] = enabled;
            apiState.value.lastUpdated = new Date().toISOString();
        }
    };

    const setTheme = (theme: 'light' | 'dark' | 'auto') => {
        settings.value.user.theme = theme;
        apiState.value.lastUpdated = new Date().toISOString();
    };

    const setLanguage = (language: string) => {
        settings.value.user.language = language;
        apiState.value.lastUpdated = new Date().toISOString();
    };

    const setTimezone = (timezone: string) => {
        settings.value.user.timezone = timezone;
        apiState.value.lastUpdated = new Date().toISOString();
    };

    const setCuttingHeight = (height: number) => {
        settings.value.machine.cuttingHeight = Math.max(20, Math.min(80, height)); // clamp between 20-80mm
        apiState.value.lastUpdated = new Date().toISOString();
    };

    const setCuttingPattern = (pattern: 'random' | 'parallel' | 'spiral') => {
        settings.value.machine.cuttingPattern = pattern;
        apiState.value.lastUpdated = new Date().toISOString();
    };

    const setSensorSensitivity = (sensitivity: 'low' | 'medium' | 'high') => {
        settings.value.machine.collisionSensorSensitivity = sensitivity;
        apiState.value.lastUpdated = new Date().toISOString();
    };

    const updateMowingSchedule = (day: string, schedule: { enabled: boolean; startTime: string; duration: number }) => {
        if (day in settings.value.yard.defaultMowingSchedule) {
            (settings.value.yard.defaultMowingSchedule as any)[day] = schedule;
            apiState.value.lastUpdated = new Date().toISOString();
        }
    };

    const setSecurityPin = (pin: string) => {
        settings.value.security.pinCode = pin;
        settings.value.security.pinRequired = pin.length > 0;
        apiState.value.lastUpdated = new Date().toISOString();
    };

    const toggleSecurityFeature = (feature: string, enabled: boolean) => {
        if (feature in settings.value.security) {
            (settings.value.security as any)[feature] = enabled;
            apiState.value.lastUpdated = new Date().toISOString();
        }
    };

    const resetToDefaults = (section?: keyof Settings) => {
        if (section) {
            // Reset specific section to defaults
            switch (section) {
                case 'user':
                    settings.value.user = {
                        theme: 'auto',
                        language: 'en',
                        timezone: 'UTC',
                        dateFormat: 'MM/dd/yyyy',
                        timeFormat: '12h',
                        temperatureUnit: 'celsius',
                        distanceUnit: 'metric',
                    };
                    break;
                case 'machine':
                    settings.value.machine = {
                        autoReturnToCharger: true,
                        autoStartAfterCharge: false,
                        rainSensorEnabled: true,
                        collisionSensorSensitivity: 'medium',
                        cuttingHeight: 50,
                        cuttingPattern: 'random',
                        edgeMode: 'always',
                        spiralMode: false,
                        gpsAccuracy: 'high',
                    };
                    break;
                // Add other sections as needed
            }
        } else {
            // Reset all settings
            $reset();
        }
        apiState.value.lastUpdated = new Date().toISOString();
    };

    const exportSettings = (): string => {
        return JSON.stringify(settings.value, null, 2);
    };

    const importSettings = (settingsJson: string): boolean => {
        try {
            const importedSettings = JSON.parse(settingsJson);

            // Validate the structure
            if (typeof importedSettings === 'object' && importedSettings !== null) {
                settings.value = { ...settings.value, ...importedSettings };
                apiState.value.lastUpdated = new Date().toISOString();
                return true;
            }
            return false;
        } catch (error) {
            setError('Invalid settings format');
            return false;
        }
    };

    const getSettingValue = (path: string): any => {
        const keys = path.split('.');
        let value: any = settings.value;

        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return undefined;
            }
        }

        return value;
    };

    const setSettingValue = (path: string, value: any): boolean => {
        const keys = path.split('.');
        const lastKey = keys.pop();

        if (!lastKey) return false;

        let current: any = settings.value;

        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return false;
            }
        }

        if (current && typeof current === 'object') {
            current[lastKey] = value;
            apiState.value.lastUpdated = new Date().toISOString();
            return true;
        }

        return false;
    };

    // API Actions (if settings are stored server-side)
    const saveSettings = async () => {
        try {
            setLoading(true);
            clearError();

            // In a real app, you'd save to server
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call

            apiState.value.loading = 'success';
        } catch (error: any) {
            setError(error.message || 'Failed to save settings');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const loadSettings = async () => {
        try {
            setLoading(true);
            clearError();

            // In a real app, you'd load from server
            await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call

            apiState.value.loading = 'success';
        } catch (error: any) {
            setError(error.message || 'Failed to load settings');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    // Reset store state
    const $reset = () => {
        settings.value = {
            user: {
                theme: 'auto',
                language: 'en',
                timezone: 'UTC',
                dateFormat: 'MM/dd/yyyy',
                timeFormat: '12h',
                temperatureUnit: 'celsius',
                distanceUnit: 'metric',
            },
            notifications: {
                email: {
                    enabled: true,
                    taskComplete: true,
                    taskFailed: true,
                    batteryLow: true,
                    maintenanceReminder: true,
                    weatherAlert: true,
                    securityAlert: true,
                },
                push: {
                    enabled: true,
                    taskComplete: true,
                    taskFailed: true,
                    batteryLow: true,
                    maintenanceReminder: false,
                    weatherAlert: true,
                    securityAlert: true,
                },
                inApp: {
                    enabled: true,
                    taskComplete: true,
                    taskFailed: true,
                    batteryLow: true,
                    maintenanceReminder: true,
                    weatherAlert: true,
                    securityAlert: true,
                },
            },
            machine: {
                autoReturnToCharger: true,
                autoStartAfterCharge: false,
                rainSensorEnabled: true,
                collisionSensorSensitivity: 'medium',
                cuttingHeight: 50,
                cuttingPattern: 'random',
                edgeMode: 'always',
                spiralMode: false,
                gpsAccuracy: 'high',
            },
            yard: {
                defaultMowingSchedule: {
                    monday: { enabled: true, startTime: '09:00', duration: 120 },
                    tuesday: { enabled: true, startTime: '09:00', duration: 120 },
                    wednesday: { enabled: true, startTime: '09:00', duration: 120 },
                    thursday: { enabled: true, startTime: '09:00', duration: 120 },
                    friday: { enabled: true, startTime: '09:00', duration: 120 },
                    saturday: { enabled: false, startTime: '10:00', duration: 90 },
                    sunday: { enabled: false, startTime: '10:00', duration: 90 },
                },
                weatherIntegration: true,
                rainDelay: 24,
                seasonalAdjustments: true,
                autoZoneDetection: true,
            },
            security: {
                pinRequired: true,
                pinCode: '',
                tiltAlarm: true,
                liftAlarm: true,
                geofenceAlerts: true,
                unauthorizedAccessAlert: true,
                nightMode: false,
            },
            maintenance: {
                autoReminders: true,
                bladeReplacementInterval: 90,
                cleaningReminder: 7,
                winterStorageReminder: true,
                serviceNotifications: true,
            },
        };

        apiState.value = {
            loading: 'idle',
            error: null,
            lastUpdated: null,
        };
    };

    return {
        // State
        settings: computed(() => settings.value),
        apiState: computed(() => apiState.value),

        // Getters
        currentTheme,
        notificationSettings,
        machineSettings,
        yardSettings,
        securitySettings,
        maintenanceSettings,
        userPreferences,
        enabledNotificationTypes,
        securityFeatures,
        isLoading,
        hasError,

        // Actions
        updateSettings,
        updateUserSettings,
        updateNotificationSettings,
        updateMachineSettings,
        updateYardSettings,
        updateSecuritySettings,
        updateMaintenanceSettings,
        toggleNotification,
        setTheme,
        setLanguage,
        setTimezone,
        setCuttingHeight,
        setCuttingPattern,
        setSensorSensitivity,
        updateMowingSchedule,
        setSecurityPin,
        toggleSecurityFeature,
        resetToDefaults,
        exportSettings,
        importSettings,
        getSettingValue,
        setSettingValue,
        saveSettings,
        loadSettings,
        clearError,
        $reset,
    };
});

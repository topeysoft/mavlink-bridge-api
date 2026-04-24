/**
 * i18n type definitions for type-safe translations
 */

import type { PRODUCT_CONFIG } from '@/config/product'

/**
 * Message schema for translations
 */
export interface MessageSchema {
  brand: {
    name: string
    shortName: string
    tagline: string
    description: string
    company: string
  }
  nav: {
    dashboard: string
    peripherals: string
    zones: string
    missions: string
    control: string
    monitoring: string
    schedule: string
    logs: string
    calibration: string
    rtcm: string
    parameters: string
    battery: string
    weather: string
    settings: string
  }
  auth: {
    login: {
      title: string
      subtitle: string
      username: string
      password: string
      pin: string
      loginButton: string
      loginWithPassword: string
      loginWithPin: string
      switchToPassword: string
      switchToPin: string
      forgotPassword: string
      needSetup: string
      sessionExpired: string
      help: {
        trigger: string
        modalTitle: string
        intro: string
        sectionTryFirst: string
        useApiKey: {
          title: string
          body: string
          action: string
        }
        usePin: {
          title: string
          body: string
          action: string
        }
        sectionReset: string
        resetWarning: string
        resetIntro: string
        resetStepsTitle: string
        resetStep1: string
        resetStep2: string
        resetStep3: string
        resetStep3Filename: string
        resetStep4: string
        devShortcutTitle: string
        devShortcutBody: string
        devShortcutCommand: string
        devShortcutCaption: string
        copy: string
        copied: string
        close: string
        recoveryToast: string
      }
    }
    setup: {
      title: string
      subtitle: string
      createAccount: string
      adminAccount: string
      username: string
      password: string
      confirmPassword: string
      createButton: string
      securityNote: string
    }
    security: {
      changePassword: string
      currentPassword: string
      newPassword: string
      confirmPassword: string
      setupPin: string
      removePin: string
      pinSetup: string
      pinRemove: string
      enterPin: string
      confirmPin: string
      apiKeys: string
      generateKey: string
    }
  }
  common: {
    actions: {
      save: string
      cancel: string
      delete: string
      edit: string
      create: string
      confirm: string
      close: string
      back: string
      next: string
      finish: string
      retry: string
      refresh: string
      disconnect: string
      connect: string
    }
    status: {
      connected: string
      disconnected: string
      connecting: string
      loading: string
      error: string
      success: string
      warning: string
      offline: string
      online: string
    }
    validation: {
      required: string
      invalidEmail: string
      passwordMismatch: string
      pinLength: string
    }
  }
  features: {
    missionTemplates: string
    missionScheduling: string
    vehicleControl: string
    flightModes: string
    mavlinkStream: string
    parameterEditor: string
    parameterConfiguration: string
    systemMonitoring: string
    telemetryCharts: string
    logDownload: string
    activityLogs: string
    geofencing: string
    rallyPoints: string
    batteryManagement: string
    weatherIntegration: string
    rtcmClient: string
    customCommands: string
    scriptExecution: string
    apiConsole: string
    debugMode: string
    experimentalFeatures: string
  }
  modes: {
    consumer: {
      label: string
      description: string
    }
    powerUser: {
      label: string
      description: string
    }
    developer: {
      label: string
      description: string
    }
  }
  onboarding: {
    welcome: {
      title: string
      subtitle: string
      getStarted: string
    }
    connection: {
      title: string
      subtitle: string
      searching: string
      manual: string
      deviceFound: string
    }
    authentication: {
      title: string
      subtitle: string
    }
    configuration: {
      title: string
      subtitle: string
      deviceName: string
      apiKey: string
    }
    completion: {
      title: string
      subtitle: string
      goToDashboard: string
    }
  }
}

/**
 * Supported locales
 * Maps user mode to locale identifier
 */
export type SupportedLocale = 'en-consumer' | 'en-technical' | 'en-developer'

/**
 * Locale map for user modes
 */
export const LOCALE_MAP: Record<'consumer' | 'power-user' | 'developer', SupportedLocale> = {
  consumer: 'en-consumer',
  'power-user': 'en-technical',
  developer: 'en-developer',
}

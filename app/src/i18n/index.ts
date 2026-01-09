/**
 * i18n configuration
 *
 * Integrates vue-i18n with mode-aware locale switching.
 * Automatically switches language based on user mode (consumer/power-user/developer).
 */

import { createI18n } from 'vue-i18n'
import type { MessageSchema, SupportedLocale } from './types'
import { LOCALE_MAP } from './types'

// Import locale messages
import enConsumer from './locales/en-consumer'
import enTechnical from './locales/en-technical'
import enDeveloper from './locales/en-developer'

/**
 * Available locale messages
 */
const messages: Record<SupportedLocale, MessageSchema> = {
  'en-consumer': enConsumer,
  'en-technical': enTechnical,
  'en-developer': enDeveloper,
}

/**
 * Get initial locale from stored user mode
 */
function getInitialLocale(): SupportedLocale {
  const storedMode = localStorage.getItem('yardrover_user_mode') as
    | 'consumer'
    | 'power-user'
    | 'developer'
    | null
  return LOCALE_MAP[storedMode || 'consumer']
}

/**
 * Create i18n instance
 */
export const i18n = createI18n<[MessageSchema], SupportedLocale>({
  legacy: false, // Use Composition API mode
  locale: getInitialLocale(),
  fallbackLocale: 'en-technical',
  messages,
  globalInjection: true, // Inject $t globally
  missingWarn: false, // Disable missing key warnings in production
  fallbackWarn: false,
})

/**
 * Switch locale based on user mode
 */
export function switchLocale(
  mode: 'consumer' | 'power-user' | 'developer'
): void {
  const locale = LOCALE_MAP[mode]
  i18n.global.locale.value = locale
}

/**
 * Get current locale
 */
export function getCurrentLocale(): SupportedLocale {
  return i18n.global.locale.value
}

/**
 * Type-safe translation function for use outside components
 */
export function t(key: string, ...args: any[]): string {
  return i18n.global.t(key, ...args)
}

export default i18n

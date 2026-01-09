// YardRover Vue 3 Composables
// Stage 7: Comprehensive collection of reusable composables

export { useMachine } from './useMachine'
export { useRealtime } from './useRealtime'
export { useYardMap } from './useYardMap'
export { useWeather } from './useWeather'
export { useNotifications } from './useNotifications'
export { usePermissions } from './usePermissions'
export { useResponsive } from './useResponsive'
export { useKeyboard } from './useKeyboard'
export { 
  useStorage, 
  useStorageManager, 
  useLocalStorage, 
  useSessionStorage,
  useUserPreferences,
  useTemporaryStorage,
  useCachedData 
} from './useStorage'

// Type exports for composables
export type { StartOptions, MachineOperationResult } from './useMachine'
export type { RealtimeOptions, RealtimeEventData } from './useRealtime'
export type { Coordinate, MapBounds, RouteOptions, ZoneCreationData } from './useYardMap'
export type { WeatherAlert, OperationSafety, WeatherPreferences } from './useWeather'
export type { NotificationPreferences, ToastNotification } from './useNotifications'
export type { Permission, Role, PermissionCheck } from './usePermissions'
export type { Breakpoints, ScreenInfo } from './useResponsive'
export type { KeyboardShortcut, ShortcutGroup } from './useKeyboard'
export type { StorageOptions, StorageItem, StorageStats } from './useStorage'
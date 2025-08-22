export interface StoreError {
  code: string
  message: string
  timestamp: number
  details?: unknown
}

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: StoreError | null
  lastUpdated: number | null
}

export function createAsyncState<T>(initialData: T | null = null): AsyncState<T> {
  return {
    data: initialData,
    loading: false,
    error: null,
    lastUpdated: null
  }
}

export function setAsyncLoading<T>(state: AsyncState<T>): void {
  state.loading = true
  state.error = null
}

export function setAsyncData<T>(state: AsyncState<T>, data: T): void {
  state.data = data
  state.loading = false
  state.error = null
  state.lastUpdated = Date.now()
}

export function setAsyncError<T>(state: AsyncState<T>, error: StoreError): void {
  state.loading = false
  state.error = error
}

export function createStoreError(code: string, message: string, details?: unknown): StoreError {
  return {
    code,
    message,
    timestamp: Date.now(),
    details
  }
}

// Task-related types for Vue components
export interface TaskTemplate {
  id: string
  name: string
  description: string
  type?: string
  category: string
  icon?: string
  color?: string
  tags?: string[]
  difficulty: number
  estimatedDuration: number
  requirements?: string[]
  parameters?: Record<string, unknown>
}

export interface TaskData {
  id?: string
  name: string
  description?: string
  type: string
  parameters?: Record<string, unknown>
  area?: TaskArea
  schedule?: TaskSchedule
}

export interface TaskArea {
  centerLat: number
  centerLng: number
  boundaries?: Array<{ lat: number; lng: number }>
  radius?: number
  width?: number
  height?: number
}

export interface TaskSchedule {
  date: string
  time: string
  frequency?: 'once' | 'daily' | 'weekly' | 'monthly'
  enabled: boolean
}

export interface TaskScheduleForm {
  taskId: string
  date: string
  time: string
  frequency: 'once' | 'daily' | 'weekly' | 'monthly'
  enabled: boolean
}

export interface ScheduledTask {
  id: string
  taskId: string
  date: string
  time: string
  frequency: 'once' | 'daily' | 'weekly' | 'monthly'
  enabled: boolean
  name: string
  status: string
  type: string
}

export interface TaskExecution {
  taskId: string
  startTime: number
  endTime?: number
  status: 'running' | 'completed' | 'failed' | 'paused'
  logs: Array<{
    timestamp: number
    level: 'info' | 'warning' | 'error'
    message: string
  }>
}
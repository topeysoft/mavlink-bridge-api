import { ref, computed, watch, onMounted, onUnmounted, type Ref } from 'vue'

export interface StorageOptions {
  prefix?: string
  serializer?: {
    read: (value: string) => any
    write: (value: any) => string
  }
  syncAcrossTabs?: boolean
  expiration?: number // milliseconds
  compress?: boolean
}

export interface StorageItem<T = any> {
  value: T
  timestamp: number
  expiration?: number
  compressed?: boolean
}

export interface StorageStats {
  totalItems: number
  totalSize: number // approximate bytes
  expiredItems: number
  prefix: string
}

export function useStorage<T>(
  key: string,
  defaultValue: T,
  storage: Storage = localStorage,
  options: StorageOptions = {}
): [Ref<T>, (value: T) => void, () => void] {
  const {
    prefix = 'yardrover',
    serializer = {
      read: JSON.parse,
      write: JSON.stringify
    },
    syncAcrossTabs = true,
    expiration,
    compress = false
  } = options
  
  const prefixedKey = `${prefix}:${key}`
  const data = ref<T>(defaultValue) as Ref<T>
  
  // Read from storage
  function read(): T {
    try {
      const item = storage.getItem(prefixedKey)
      if (item === null) return defaultValue
      
      const parsed: StorageItem<T> = serializer.read(item)
      
      // Check expiration
      if (parsed.expiration && Date.now() > parsed.expiration) {
        storage.removeItem(prefixedKey)
        return defaultValue
      }
      
      // Handle compressed data
      if (parsed.compressed && typeof parsed.value === 'string') {
        // Simple compression using base64 - in real implementation might use proper compression
        const decompressed = atob(parsed.value)
        return serializer.read(decompressed)
      }
      
      return parsed.value ?? defaultValue
    } catch (error) {
      console.warn(`Failed to read storage key "${prefixedKey}":`, error)
      return defaultValue
    }
  }
  
  // Write to storage
  function write(value: T): void {
    try {
      const now = Date.now()
      const item: StorageItem<T> = {
        value,
        timestamp: now,
        expiration: expiration ? now + expiration : undefined,
        compressed: compress
      }
      
      let serializedValue = value
      
      // Handle compression
      if (compress && typeof value === 'object') {
        const jsonString = serializer.write(value)
        serializedValue = btoa(jsonString) as T
        item.compressed = true
        item.value = serializedValue
      }
      
      const serialized = serializer.write(item)
      storage.setItem(prefixedKey, serialized)
      data.value = value
    } catch (error) {
      console.error(`Failed to write storage key "${prefixedKey}":`, error)
    }
  }
  
  // Remove from storage
  function remove(): void {
    try {
      storage.removeItem(prefixedKey)
      data.value = defaultValue
    } catch (error) {
      console.error(`Failed to remove storage key "${prefixedKey}":`, error)
    }
  }
  
  // Handle storage events (sync across tabs)
  function handleStorageEvent(e: StorageEvent): void {
    if (!syncAcrossTabs || e.key !== prefixedKey || e.storageArea !== storage) return
    
    if (e.newValue === null) {
      data.value = defaultValue
    } else {
      data.value = read()
    }
  }
  
  // Initialize
  onMounted(() => {
    data.value = read()
    
    if (syncAcrossTabs) {
      window.addEventListener('storage', handleStorageEvent)
    }
  })
  
  onUnmounted(() => {
    if (syncAcrossTabs) {
      window.removeEventListener('storage', handleStorageEvent)
    }
  })
  
  return [data, write, remove]
}

// Composable for managing multiple storage items with a common prefix
export function useStorageManager(prefix = 'yardrover', storage: Storage = localStorage) {
  const items = ref<Map<string, any>>(new Map())
  
  function getFullKey(key: string): string {
    return `${prefix}:${key}`
  }
  
  function set<T>(key: string, value: T, options: StorageOptions = {}): void {
    const fullKey = getFullKey(key)
    const now = Date.now()
    
    const item: StorageItem<T> = {
      value,
      timestamp: now,
      expiration: options.expiration ? now + options.expiration : undefined
    }
    
    try {
      const serialized = (options.serializer?.write || JSON.stringify)(item)
      storage.setItem(fullKey, serialized)
      items.value.set(key, value)
    } catch (error) {
      console.error(`Failed to set storage item "${fullKey}":`, error)
    }
  }
  
  function get<T>(key: string, defaultValue?: T, options: StorageOptions = {}): T | null {
    const fullKey = getFullKey(key)
    
    try {
      const item = storage.getItem(fullKey)
      if (item === null) return defaultValue ?? null
      
      const parsed: StorageItem<T> = (options.serializer?.read || JSON.parse)(item)
      
      // Check expiration
      if (parsed.expiration && Date.now() > parsed.expiration) {
        storage.removeItem(fullKey)
        return defaultValue ?? null
      }
      
      const value = parsed.value ?? defaultValue ?? null
      if (value !== null) {
        items.value.set(key, value)
      }
      
      return value
    } catch (error) {
      console.warn(`Failed to get storage item "${fullKey}":`, error)
      return defaultValue ?? null
    }
  }
  
  function remove(key: string): void {
    const fullKey = getFullKey(key)
    
    try {
      storage.removeItem(fullKey)
      items.value.delete(key)
    } catch (error) {
      console.error(`Failed to remove storage item "${fullKey}":`, error)
    }
  }
  
  function clear(): void {
    try {
      const keysToRemove: string[] = []
      
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i)
        if (key?.startsWith(`${prefix}:`)) {
          keysToRemove.push(key)
        }
      }
      
      keysToRemove.forEach(key => storage.removeItem(key))
      items.value.clear()
    } catch (error) {
      console.error('Failed to clear storage:', error)
    }
  }
  
  function has(key: string): boolean {
    const fullKey = getFullKey(key)
    return storage.getItem(fullKey) !== null
  }
  
  function keys(): string[] {
    const prefixedKeys: string[] = []
    
    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i)
        if (key?.startsWith(`${prefix}:`)) {
          prefixedKeys.push(key.substring(prefix.length + 1))
        }
      }
    } catch (error) {
      console.error('Failed to get storage keys:', error)
    }
    
    return prefixedKeys
  }
  
  function getStats(): StorageStats {
    const allKeys = keys()
    let totalSize = 0
    let expiredItems = 0
    
    allKeys.forEach(key => {
      const fullKey = getFullKey(key)
      const item = storage.getItem(fullKey)
      
      if (item) {
        totalSize += item.length * 2 // Rough estimate (UTF-16)
        
        try {
          const parsed: StorageItem = JSON.parse(item)
          if (parsed.expiration && Date.now() > parsed.expiration) {
            expiredItems++
          }
        } catch {
          // Ignore parsing errors
        }
      }
    })
    
    return {
      totalItems: allKeys.length,
      totalSize,
      expiredItems,
      prefix
    }
  }
  
  function cleanup(): number {
    const allKeys = keys()
    let removedCount = 0
    
    allKeys.forEach(key => {
      const fullKey = getFullKey(key)
      const item = storage.getItem(fullKey)
      
      if (item) {
        try {
          const parsed: StorageItem = JSON.parse(item)
          if (parsed.expiration && Date.now() > parsed.expiration) {
            storage.removeItem(fullKey)
            items.value.delete(key)
            removedCount++
          }
        } catch {
          // Remove corrupted items
          storage.removeItem(fullKey)
          items.value.delete(key)
          removedCount++
        }
      }
    })
    
    return removedCount
  }
  
  function export(): Record<string, any> {
    const data: Record<string, any> = {}
    
    keys().forEach(key => {
      const value = get(key)
      if (value !== null) {
        data[key] = value
      }
    })
    
    return data
  }
  
  function import(data: Record<string, any>, overwrite = false): void {
    Object.entries(data).forEach(([key, value]) => {
      if (overwrite || !has(key)) {
        set(key, value)
      }
    })
  }
  
  // Reactive access to all items
  const allItems = computed(() => Object.fromEntries(items.value))
  
  return {
    // State
    items: allItems,
    
    // Methods
    set,
    get,
    remove,
    clear,
    has,
    keys,
    getStats,
    cleanup,
    export,
    import
  }
}

// Specific composables for common storage patterns
export function useLocalStorage<T>(key: string, defaultValue: T, options?: StorageOptions) {
  return useStorage(key, defaultValue, localStorage, options)
}

export function useSessionStorage<T>(key: string, defaultValue: T, options?: StorageOptions) {
  return useStorage(key, defaultValue, sessionStorage, options)
}

// Composable for user preferences
export function useUserPreferences<T extends Record<string, any>>(
  defaultPreferences: T,
  options: StorageOptions = {}
) {
  const [preferences, setPreferences] = useLocalStorage(
    'user-preferences',
    defaultPreferences,
    {
      syncAcrossTabs: true,
      ...options
    }
  )
  
  function updatePreference<K extends keyof T>(key: K, value: T[K]): void {
    const updated = { ...preferences.value, [key]: value }
    setPreferences(updated)
  }
  
  function resetPreferences(): void {
    setPreferences(defaultPreferences)
  }
  
  function getPreference<K extends keyof T>(key: K): T[K] {
    return preferences.value[key] ?? defaultPreferences[key]
  }
  
  return {
    preferences,
    updatePreference,
    resetPreferences,
    getPreference,
    setPreferences
  }
}

// Composable for temporary storage with automatic cleanup
export function useTemporaryStorage<T>(
  key: string,
  defaultValue: T,
  ttl = 3600000 // 1 hour default
) {
  return useStorage(key, defaultValue, sessionStorage, {
    expiration: ttl,
    syncAcrossTabs: false
  })
}

// Composable for cached data with refresh capability
export function useCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    defaultValue: T
    ttl?: number
    refreshOnMount?: boolean
    storage?: Storage
  }
) {
  const {
    defaultValue,
    ttl = 300000, // 5 minutes default
    refreshOnMount = true,
    storage = localStorage
  } = options
  
  const [cachedData, setCachedData] = useStorage(key, defaultValue, storage, {
    expiration: ttl,
    syncAcrossTabs: true
  })
  
  const isLoading = ref(false)
  const error = ref<Error | null>(null)
  const lastFetch = ref<number | null>(null)
  
  async function refresh(force = false): Promise<T> {
    // Don't refresh if we just fetched recently (unless forced)
    if (!force && lastFetch.value && Date.now() - lastFetch.value < 10000) {
      return cachedData.value
    }
    
    isLoading.value = true
    error.value = null
    
    try {
      const data = await fetcher()
      setCachedData(data)
      lastFetch.value = Date.now()
      return data
    } catch (err) {
      error.value = err as Error
      return cachedData.value
    } finally {
      isLoading.value = false
    }
  }
  
  const isStale = computed(() => {
    return lastFetch.value === null || Date.now() - lastFetch.value > ttl
  })
  
  onMounted(() => {
    if (refreshOnMount || isStale.value) {
      refresh()
    }
  })
  
  return {
    data: cachedData,
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    isStale,
    refresh
  }
}
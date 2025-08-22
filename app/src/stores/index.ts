import { store } from 'quasar/wrappers'
import { createPinia } from 'pinia'
import { createPersistedState } from 'pinia-plugin-persistedstate'
import { watch } from 'vue'
import { useMAVLinkClient } from '../composables/useMAVLinkClient'
import { useDeviceStore } from './device'
import { useConfigurationStore } from './configuration'
import { useWiFiStore } from './wifi'
import { useMAVLinkParametersStore } from './mavlink-parameters'
import { useTaskStore } from './tasks'

/*
 * When adding new properties to stores, you should also
 * extend the `PiniaCustomProperties` interface.
 * @see https://pinia.vuejs.org/core-concepts/plugins.html#typing-new-store-properties
 */
declare module 'pinia' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface PiniaCustomProperties {
    // add your custom properties here, if any
  }
}

/**
 * Initialize all stores and set up their WebSocket handlers
 */
export function initializeStores() {
  const { isConnected } = useMAVLinkClient()
  
  const deviceStore = useDeviceStore()
  const configStore = useConfigurationStore()
  const wifiStore = useWiFiStore()
  const parametersStore = useMAVLinkParametersStore()
  const taskStore = useTaskStore()
  
  // Set up WebSocket handlers when connected
  watch(isConnected, (connected) => {
    if (connected) {
      // Set up WebSocket event handlers
      deviceStore.setupWebSocketHandlers()
      configStore.setupWebSocketHandlers()
      wifiStore.setupWebSocketHandlers()
      parametersStore.setupWebSocketHandlers()
      taskStore.setupWebSocketHandlers()
      
      // Initial data fetch
      deviceStore.fetchHealth().catch(console.error)
      configStore.fetchConfiguration().catch(console.error)
      wifiStore.fetchStatus().catch(console.error)
      void taskStore.fetchTasks()
    }
  }, { immediate: true })
}

/*
 * If not building with SSR mode, you can
 * directly export the Store instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Store instance.
 */

export default store((/* { ssrContext } */) => {
  const pinia = createPinia()

  // Add Pinia plugins
  pinia.use(createPersistedState())

  return pinia
})

// Export all stores
export * from './device'
export * from './configuration'
export * from './wifi'
export * from './mavlink-parameters'
export * from './tasks'
export * from './mavlink'
export * from './app-config'
export * from './example-store'
export * from './types'

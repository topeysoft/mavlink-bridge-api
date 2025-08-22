import { boot } from 'quasar/wrappers'
import { initializeStores } from '../stores'
import { useConnectionManager } from '../composables/useConnectionManager'

export default boot(async () => {
  // Initialize all stores and their WebSocket handlers
  initializeStores()
  
  // Try auto-connect
  const { autoConnect } = useConnectionManager()
  
  try {
    await autoConnect()
  } catch {
    console.log('Auto-connect failed, user will need to connect manually')
  }
})
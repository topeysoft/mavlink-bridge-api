import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useNotificationsStore } from '@/stores/notifications'

export interface KeyboardShortcut {
  id: string
  keys: string[]
  description: string
  category: string
  handler: (event: KeyboardEvent) => void | Promise<void>
  enabled: boolean
  preventDefault?: boolean
  stopPropagation?: boolean
  global?: boolean
  element?: HTMLElement | null
}

export interface ShortcutGroup {
  name: string
  category: string
  shortcuts: KeyboardShortcut[]
}

export function useKeyboard() {
  const notificationsStore = useNotificationsStore()
  
  // State
  const shortcuts = ref<Map<string, KeyboardShortcut>>(new Map())
  const pressedKeys = ref<Set<string>>(new Set())
  const enabled = ref(true)
  const showHelp = ref(false)
  const lastKeySequence = ref<string[]>([])
  const sequenceTimeout = ref<number | null>(null)
  
  // Key mapping for better cross-platform support
  const keyMap = new Map([
    ['Meta', 'Cmd'],
    ['Control', 'Ctrl'],
    ['Alt', 'Alt'],
    ['Shift', 'Shift'],
    [' ', 'Space'],
    ['ArrowUp', '↑'],
    ['ArrowDown', '↓'],
    ['ArrowLeft', '←'],
    ['ArrowRight', '→'],
    ['Escape', 'Esc'],
    ['Enter', 'Enter'],
    ['Tab', 'Tab'],
    ['Backspace', 'Backspace'],
    ['Delete', 'Del']
  ])
  
  // Computed
  const shortcutGroups = computed((): ShortcutGroup[] => {
    const groups = new Map<string, ShortcutGroup>()
    
    shortcuts.value.forEach(shortcut => {
      if (!groups.has(shortcut.category)) {
        groups.set(shortcut.category, {
          name: shortcut.category,
          category: shortcut.category,
          shortcuts: []
        })
      }
      
      groups.get(shortcut.category)!.shortcuts.push(shortcut)
    })
    
    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name))
  })
  
  const activeShortcuts = computed(() => {
    return Array.from(shortcuts.value.values()).filter(s => s.enabled)
  })
  
  const currentKeyCombo = computed(() => {
    if (pressedKeys.value.size === 0) return ''
    
    const keys = Array.from(pressedKeys.value)
      .map(key => keyMap.get(key) || key)
      .sort((a, b) => {
        // Sort modifiers first
        const modifierOrder = ['Ctrl', 'Cmd', 'Alt', 'Shift']
        const aIndex = modifierOrder.indexOf(a)
        const bIndex = modifierOrder.indexOf(b)
        
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
        if (aIndex !== -1) return -1
        if (bIndex !== -1) return 1
        
        return a.localeCompare(b)
      })
    
    return keys.join('+')
  })
  
  // Default shortcuts
  const defaultShortcuts: Omit<KeyboardShortcut, 'id'>[] = [
    // Navigation
    {
      keys: ['Alt', 'd'],
      description: 'Go to Dashboard',
      category: 'Navigation',
      handler: () => navigateTo('/dashboard'),
      enabled: true,
      global: true
    },
    {
      keys: ['Alt', 'm'],
      description: 'Go to Machines',
      category: 'Navigation',
      handler: () => navigateTo('/machines'),
      enabled: true,
      global: true
    },
    {
      keys: ['Alt', 't'],
      description: 'Go to Tasks',
      category: 'Navigation',
      handler: () => navigateTo('/tasks'),
      enabled: true,
      global: true
    },
    {
      keys: ['Alt', 'y'],
      description: 'Go to Yards',
      category: 'Navigation',
      handler: () => navigateTo('/yards'),
      enabled: true,
      global: true
    },
    
    // Machine Control
    {
      keys: ['Ctrl', 's'],
      description: 'Start Machine',
      category: 'Machine Control',
      handler: async () => {
        // This would trigger machine start
        notificationsStore.info('Shortcut', 'Start machine shortcut pressed')
      },
      enabled: true,
      preventDefault: true
    },
    {
      keys: ['Ctrl', 'Shift', 's'],
      description: 'Stop Machine',
      category: 'Machine Control',
      handler: async () => {
        notificationsStore.info('Shortcut', 'Stop machine shortcut pressed')
      },
      enabled: true,
      preventDefault: true
    },
    {
      keys: ['Ctrl', 'e'],
      description: 'Emergency Stop',
      category: 'Machine Control',
      handler: async () => {
        notificationsStore.warning('Emergency Stop', 'Emergency stop activated via keyboard')
      },
      enabled: true,
      preventDefault: true
    },
    
    // General
    {
      keys: ['?'],
      description: 'Show Keyboard Shortcuts',
      category: 'General',
      handler: () => {
        showHelp.value = !showHelp.value
      },
      enabled: true,
      global: true
    },
    {
      keys: ['Escape'],
      description: 'Close Modals/Dialogs',
      category: 'General',
      handler: () => {
        // This would close any open modals
        showHelp.value = false
      },
      enabled: true,
      global: true
    },
    {
      keys: ['Ctrl', '/'],
      description: 'Toggle Command Palette',
      category: 'General',
      handler: () => {
        notificationsStore.info('Shortcut', 'Command palette toggled')
      },
      enabled: true,
      preventDefault: true,
      global: true
    },
    
    // Tasks
    {
      keys: ['Ctrl', 'n'],
      description: 'New Task',
      category: 'Tasks',
      handler: () => {
        notificationsStore.info('Shortcut', 'New task creation triggered')
      },
      enabled: true,
      preventDefault: true
    },
    {
      keys: ['Ctrl', 'r'],
      description: 'Refresh Data',
      category: 'General',
      handler: () => {
        // This would refresh current data
        notificationsStore.info('Shortcut', 'Data refresh triggered')
      },
      enabled: true,
      preventDefault: true
    }
  ]
  
  // Methods
  function normalizeKey(key: string): string {
    // Handle special keys
    const specialKeys: Record<string, string> = {
      ' ': 'Space',
      'ArrowUp': '↑',
      'ArrowDown': '↓',
      'ArrowLeft': '←',
      'ArrowRight': '→'
    }
    
    return specialKeys[key] || key
  }
  
  function createShortcutId(keys: string[]): string {
    return keys.map(k => normalizeKey(k)).sort().join('+')
  }
  
  function addShortcut(shortcut: Omit<KeyboardShortcut, 'id'>): string {
    const id = shortcut.keys.length > 0 ? createShortcutId(shortcut.keys) : Math.random().toString(36)
    
    const fullShortcut: KeyboardShortcut = {
      id,
      preventDefault: true,
      stopPropagation: false,
      global: false,
      ...shortcut
    }
    
    shortcuts.value.set(id, fullShortcut)
    return id
  }
  
  function removeShortcut(id: string): boolean {
    return shortcuts.value.delete(id)
  }
  
  function updateShortcut(id: string, updates: Partial<KeyboardShortcut>): boolean {
    const shortcut = shortcuts.value.get(id)
    if (!shortcut) return false
    
    shortcuts.value.set(id, { ...shortcut, ...updates })
    return true
  }
  
  function enableShortcut(id: string): boolean {
    return updateShortcut(id, { enabled: true })
  }
  
  function disableShortcut(id: string): boolean {
    return updateShortcut(id, { enabled: false })
  }
  
  function toggleShortcut(id: string): boolean {
    const shortcut = shortcuts.value.get(id)
    if (!shortcut) return false
    
    return updateShortcut(id, { enabled: !shortcut.enabled })
  }
  
  function enableCategory(category: string): void {
    shortcuts.value.forEach(shortcut => {
      if (shortcut.category === category) {
        shortcut.enabled = true
      }
    })
  }
  
  function disableCategory(category: string): void {
    shortcuts.value.forEach(shortcut => {
      if (shortcut.category === category) {
        shortcut.enabled = false
      }
    })
  }
  
  function findShortcut(keys: string[]): KeyboardShortcut | null {
    const id = createShortcutId(keys)
    return shortcuts.value.get(id) || null
  }
  
  function getShortcutsByCategory(category: string): KeyboardShortcut[] {
    return Array.from(shortcuts.value.values()).filter(s => s.category === category)
  }
  
  function isModifierKey(key: string): boolean {
    return ['Control', 'Alt', 'Shift', 'Meta'].includes(key)
  }
  
  function getKeyCombination(event: KeyboardEvent): string[] {
    const keys: string[] = []
    
    if (event.ctrlKey || event.metaKey) keys.push(event.ctrlKey ? 'Control' : 'Meta')
    if (event.altKey) keys.push('Alt')
    if (event.shiftKey) keys.push('Shift')
    
    if (!isModifierKey(event.key)) {
      keys.push(event.key)
    }
    
    return keys
  }
  
  function matchesShortcut(shortcut: KeyboardShortcut, keys: string[]): boolean {
    if (shortcut.keys.length !== keys.length) return false
    
    const shortcutKeys = [...shortcut.keys].sort()
    const inputKeys = [...keys].sort()
    
    return shortcutKeys.every((key, index) => key === inputKeys[index])
  }
  
  async function executeShortcut(shortcut: KeyboardShortcut, event: KeyboardEvent): Promise<void> {
    try {
      if (shortcut.preventDefault) {
        event.preventDefault()
      }
      
      if (shortcut.stopPropagation) {
        event.stopPropagation()
      }
      
      await shortcut.handler(event)
    } catch (error) {
      console.error('Error executing shortcut:', error)
      notificationsStore.error('Shortcut Error', 'Failed to execute keyboard shortcut')
    }
  }
  
  // Event handlers
  function handleKeyDown(event: KeyboardEvent): void {
    if (!enabled.value) return
    
    // Add key to pressed set
    pressedKeys.value.add(event.key)
    
    // Clear sequence timeout
    if (sequenceTimeout.value) {
      clearTimeout(sequenceTimeout.value)
    }
    
    // Update last key sequence
    lastKeySequence.value.push(event.key)
    if (lastKeySequence.value.length > 5) {
      lastKeySequence.value.shift()
    }
    
    // Set new sequence timeout
    sequenceTimeout.value = window.setTimeout(() => {
      lastKeySequence.value = []
    }, 1000)
    
    // Get current key combination
    const keys = getKeyCombination(event)
    
    if (keys.length === 0) return
    
    // Find matching shortcut
    const matchingShortcut = Array.from(shortcuts.value.values()).find(shortcut => {
      if (!shortcut.enabled) return false
      
      // Check if shortcut is scoped to specific element
      if (!shortcut.global && shortcut.element) {
        const target = event.target as HTMLElement
        if (!shortcut.element.contains(target)) return false
      }
      
      return matchesShortcut(shortcut, keys)
    })
    
    if (matchingShortcut) {
      executeShortcut(matchingShortcut, event)
    }
  }
  
  function handleKeyUp(event: KeyboardEvent): void {
    pressedKeys.value.delete(event.key)
  }
  
  function handleWindowBlur(): void {
    // Clear pressed keys when window loses focus
    pressedKeys.value.clear()
  }
  
  // Navigation helper
  function navigateTo(path: string): void {
    // This would use Vue Router in a real implementation
    console.log('Navigate to:', path)
    notificationsStore.info('Navigation', `Navigating to ${path}`)
  }
  
  // Utility methods
  function formatShortcut(keys: string[]): string {
    return keys.map(key => keyMap.get(key) || key).join(' + ')
  }
  
  function exportShortcuts(): string {
    const data = Array.from(shortcuts.value.values()).map(shortcut => ({
      keys: shortcut.keys,
      description: shortcut.description,
      category: shortcut.category,
      enabled: shortcut.enabled
    }))
    
    return JSON.stringify(data, null, 2)
  }
  
  function importShortcuts(data: string): boolean {
    try {
      const parsed = JSON.parse(data)
      
      if (!Array.isArray(parsed)) return false
      
      parsed.forEach((item: any) => {
        if (item.keys && item.description && item.category) {
          addShortcut({
            keys: item.keys,
            description: item.description,
            category: item.category,
            enabled: item.enabled ?? true,
            handler: () => {
              notificationsStore.info('Imported Shortcut', `Executed: ${item.description}`)
            }
          })
        }
      })
      
      return true
    } catch (error) {
      console.error('Failed to import shortcuts:', error)
      return false
    }
  }
  
  function resetToDefaults(): void {
    shortcuts.value.clear()
    
    defaultShortcuts.forEach(shortcut => {
      addShortcut(shortcut)
    })
  }
  
  function getHelpText(): string {
    return shortcutGroups.value
      .map(group => {
        const groupShortcuts = group.shortcuts
          .filter(s => s.enabled)
          .map(s => `  ${formatShortcut(s.keys).padEnd(20)} ${s.description}`)
          .join('\n')
        
        return `${group.name}:\n${groupShortcuts}`
      })
      .join('\n\n')
  }
  
  // Global enable/disable
  function enable(): void {
    enabled.value = true
  }
  
  function disable(): void {
    enabled.value = false
    pressedKeys.value.clear()
  }
  
  function toggle(): void {
    enabled.value ? disable() : enable()
  }
  
  // Initialize with default shortcuts
  function initialize(): void {
    resetToDefaults()
  }
  
  // Lifecycle
  onMounted(() => {
    initialize()
    
    // Add global event listeners
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleWindowBlur)
  })
  
  onUnmounted(() => {
    // Clean up event listeners
    document.removeEventListener('keydown', handleKeyDown)
    document.removeEventListener('keyup', handleKeyUp)
    window.removeEventListener('blur', handleWindowBlur)
    
    // Clear timeouts
    if (sequenceTimeout.value) {
      clearTimeout(sequenceTimeout.value)
    }
  })
  
  return {
    // State
    shortcuts: computed(() => shortcuts.value),
    shortcutGroups,
    activeShortcuts,
    pressedKeys: computed(() => pressedKeys.value),
    currentKeyCombo,
    enabled: computed(() => enabled.value),
    showHelp: computed({
      get: () => showHelp.value,
      set: (value: boolean) => { showHelp.value = value }
    }),
    lastKeySequence: computed(() => lastKeySequence.value),
    
    // Shortcut management
    addShortcut,
    removeShortcut,
    updateShortcut,
    enableShortcut,
    disableShortcut,
    toggleShortcut,
    enableCategory,
    disableCategory,
    findShortcut,
    getShortcutsByCategory,
    
    // Global controls
    enable,
    disable,
    toggle,
    
    // Utility methods
    formatShortcut,
    exportShortcuts,
    importShortcuts,
    resetToDefaults,
    getHelpText,
    
    // Event handling (for manual use)
    handleKeyDown,
    handleKeyUp
  }
}
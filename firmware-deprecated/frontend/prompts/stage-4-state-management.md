# Stage 4: State Management with Pinia

## Objective

Implement comprehensive state management using Pinia stores for machine control, user preferences, task management, and real-time status updates.

## Tasks

1. Create Pinia store modules for different domains
2. Implement actions for API calls and state mutations
3. Set up getters for computed state values
4. Create store plugins for persistence
5. Implement WebSocket integration for real-time updates
6. Set up store composition for complex state
7. Create TypeScript interfaces for store state
8. Implement undo/redo functionality for actions
9. Set up store devtools integration
10. Create store testing utilities

## Store Structure

```typescript
src/stores/
├── machine.ts         // Machine state and control
├── tasks.ts          // Task queue and scheduling
├── user.ts           // User authentication and profile
├── settings.ts       // Application settings
├── yard.ts           // Yard map and zones
├── notifications.ts  // System notifications
├── websocket.ts      // WebSocket connection state
└── ui.ts             // UI state (modals, drawers, etc.)
```

## Machine Store Example

```typescript
interface MachineState {
  status: 'idle' | 'running' | 'paused' | 'error'
  mode: 'mowing' | 'snow' | 'leaf' | 'towing' | 'patrol'
  battery: number
  location: { lat: number; lng: number }
  speed: number
  runtime: number
  lastUpdate: Date
  errors: MachineError[]
}

const useMachineStore = defineStore('machine', {
  state: (): MachineState => ({
    // Initial state
  }),
  
  getters: {
    isOperational: (state) => state.status !== 'error',
    batteryPercentage: (state) => `${state.battery}%`,
    currentTask: (state) => state.mode
  },
  
  actions: {
    async startMachine(mode: MachineMode) {
      // API call and state update
    },
    
    async stopMachine() {
      // API call and state update
    },
    
    updateFromWebSocket(data: MachineUpdate) {
      // Real-time state updates
    }
  }
})
```

## Store Composition Pattern

```typescript
// Combining multiple stores
const useYardRoverStore = () => {
  const machine = useMachineStore()
  const tasks = useTasksStore()
  const yard = useYardStore()
  
  return {
    machine,
    tasks,
    yard,
    
    // Computed properties combining stores
    canStartNewTask: computed(() => 
      machine.isOperational && tasks.queue.length > 0
    )
  }
}
```

## Expected Output

A complete Pinia-based state management system with real-time updates, persistence, and TypeScript support.

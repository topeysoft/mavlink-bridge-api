# Stage 5: Core Vue Components Development

## Objective

Build the core Vue 3 components using Composition API with TypeScript, focusing on machine control, status monitoring, and user interaction with nature-themed styling.

## Tasks

1. Create machine control panel component
2. Build real-time status display component
3. Develop task scheduling interface
4. Create battery and system health indicators
5. Build yard map visualization component
6. Implement notification system
7. Create settings and configuration panels
8. Build responsive navigation components
9. Implement loading and error states
10. Create reusable UI components library

## Component Structure

```
src/components/
├── machine/
│   ├── MachineControl.vue      // Start/stop/pause controls
│   ├── MachineStatus.vue       // Real-time status display
│   ├── ModeSelector.vue        // Operation mode selection
│   └── SpeedControl.vue        // Speed adjustment
├── monitoring/
│   ├── BatteryIndicator.vue    // Battery level display
│   ├── LocationTracker.vue     // GPS tracking display
│   ├── SystemHealth.vue        // Overall system status
│   └── RuntimeStats.vue        // Operation statistics
├── tasks/
│   ├── TaskQueue.vue           // Scheduled tasks list
│   ├── TaskEditor.vue          // Create/edit tasks
│   ├── TaskCalendar.vue        // Calendar view
│   └── TaskHistory.vue         // Completed tasks
├── yard/
│   ├── YardMap.vue             // Interactive yard map
│   ├── ZoneEditor.vue          // Define mowing zones
│   ├── ObstacleMarker.vue      // Mark obstacles
│   └── RouteVisualizer.vue     // Show planned routes
├── ui/
│   ├── NatureCard.vue          // Themed card component
│   ├── GrassButton.vue         // Nature-themed button
│   ├── LeafLoader.vue          // Loading animation
│   └── WeatherWidget.vue       // Weather conditions
└── layout/
    ├── AppHeader.vue           // Main navigation
    ├── AppSidebar.vue          // Side navigation
    ├── AppFooter.vue           // Status bar
    └── MobileNav.vue           // Mobile navigation
```

## Example Component: MachineControl.vue

```vue
<template>
  <q-card class="machine-control nature-card">
    <q-card-section class="bg-grass-green text-white">
      <h2 class="text-h5">Machine Control</h2>
    </q-card-section>
    
    <q-card-section>
      <div class="control-grid">
        <q-btn
          :loading="isStarting"
          @click="handleStart"
          color="grass-green"
          icon="play_arrow"
          label="Start"
          :disable="!canStart"
        />
        
        <q-btn
          @click="handleStop"
          color="earth-brown"
          icon="stop"
          label="Stop"
          :disable="!isRunning"
        />
        
        <q-btn
          @click="handlePause"
          color="sky-blue"
          icon="pause"
          label="Pause"
          :disable="!canPause"
        />
      </div>
      
      <ModeSelector v-model="selectedMode" class="q-mt-md" />
      
      <SpeedControl v-model="speed" :max="maxSpeed" class="q-mt-md" />
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMachineStore } from '@/stores/machine'
import { useQuasar } from 'quasar'
import ModeSelector from './ModeSelector.vue'
import SpeedControl from './SpeedControl.vue'

const $q = useQuasar()
const machineStore = useMachineStore()

const isStarting = ref(false)
const selectedMode = ref('mowing')
const speed = ref(50)

const isRunning = computed(() => machineStore.status === 'running')
const canStart = computed(() => machineStore.status === 'idle')
const canPause = computed(() => machineStore.status === 'running')
const maxSpeed = computed(() => machineStore.maxSpeed)

async function handleStart() {
  isStarting.value = true
  try {
    await machineStore.startMachine({
      mode: selectedMode.value,
      speed: speed.value
    })
    $q.notify({
      type: 'positive',
      message: 'Machine started successfully',
      icon: 'grass'
    })
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to start machine',
      caption: error.message
    })
  } finally {
    isStarting.value = false
  }
}

async function handleStop() {
  await machineStore.stopMachine()
}

async function handlePause() {
  await machineStore.pauseMachine()
}
</script>

<style scoped lang="scss">
.machine-control {
  .control-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }
  
  .bg-grass-green {
    background: linear-gradient(135deg, $grass-green, darken($grass-green, 10%));
  }
}
</style>
```

## Expected Output

A comprehensive set of Vue 3 components with nature-themed styling, real-time updates, and responsive design.

<script setup lang="ts">
import { computed } from 'vue'
import type { FlightMode } from '@/stores/vehicle'

interface Props {
  currentMode: FlightMode
  disabled?: boolean
}

interface Emits {
  (e: 'change', mode: FlightMode): void
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})

const emit = defineEmits<Emits>()

interface ModeInfo {
  mode: FlightMode
  label: string
  description: string
  icon: string
  color: string
}

const flightModes: ModeInfo[] = [
  {
    mode: 'MANUAL',
    label: 'Manual',
    description: 'Full manual control via joystick/remote',
    icon: 'M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z',
    color: '#6366f1',
  },
  {
    mode: 'HOLD',
    label: 'Hold',
    description: 'Stop and hold current position',
    icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z',
    color: '#f59e0b',
  },
  {
    mode: 'AUTO',
    label: 'Auto',
    description: 'Execute pre-planned mission autonomously',
    icon: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z',
    color: '#10b981',
  },
  {
    mode: 'GUIDED',
    label: 'Guided',
    description: 'Navigate to commanded waypoints',
    icon: 'M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z',
    color: '#3b82f6',
  },
  {
    mode: 'RTL',
    label: 'RTL',
    description: 'Return to launch position',
    icon: 'M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z',
    color: '#ec4899',
  },
  {
    mode: 'SMART_RTL',
    label: 'Smart RTL',
    description: 'Return via recorded path',
    icon: 'M12 2l-5.5 9h11L12 2zm0 3.84L13.93 9h-3.87L12 5.84zM17.5 13c-1.93 0-3.5 1.57-3.5 3.5s1.57 3.5 3.5 3.5 3.5-1.57 3.5-3.5-1.57-3.5-3.5-3.5zm0 5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM6.5 13C4.57 13 3 14.57 3 16.5S4.57 20 6.5 20 10 18.43 10 16.5 8.43 13 6.5 13zm0 5C5.67 18 5 17.33 5 16.5S5.67 15 6.5 15 8 15.67 8 16.5 7.33 18 6.5 18z',
    color: '#8b5cf6',
  },
  {
    mode: 'STEERING',
    label: 'Steering',
    description: 'Manual steering with speed control',
    icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
    color: '#14b8a6',
  },
  {
    mode: 'ACRO',
    label: 'Acro',
    description: 'Acrobatic mode for advanced control',
    icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm0-4h-2V7h2v8z',
    color: '#ef4444',
  },
]

const selectedMode = computed(() => {
  return flightModes.find(m => m.mode === props.currentMode)
})

function handleModeChange(mode: FlightMode) {
  if (!props.disabled && mode !== props.currentMode) {
    emit('change', mode)
  }
}
</script>

<template>
  <div class="flight-mode-selector">
    <div class="current-mode" v-if="selectedMode">
      <div class="mode-indicator" :style="{ backgroundColor: selectedMode.color }"></div>
      <div class="mode-info">
        <div class="mode-label">{{ selectedMode.label }}</div>
        <div class="mode-description">{{ selectedMode.description }}</div>
      </div>
    </div>

    <div class="mode-grid">
      <button
        v-for="mode in flightModes"
        :key="mode.mode"
        class="mode-button"
        :class="{ active: mode.mode === currentMode, disabled }"
        :disabled="disabled"
        @click="handleModeChange(mode.mode)"
      >
        <svg
          class="mode-icon"
          :style="{ color: mode.mode === currentMode ? mode.color : 'var(--text-secondary)' }"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path :d="mode.icon" />
        </svg>
        <div class="mode-name">{{ mode.label }}</div>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.flight-mode-selector {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.current-mode {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}

.mode-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.mode-info {
  flex: 1;
}

.mode-label {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.mode-description {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.mode-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: var(--spacing-sm);
}

.mode-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(.disabled) {
    background: var(--bg-tertiary);
    border-color: var(--primary-green);
    transform: translateY(-2px);
  }

  &.active {
    background: var(--bg-tertiary);
    border-color: var(--primary-green);
    box-shadow: 0 0 0 3px rgba(44, 95, 45, 0.1);

    .mode-icon {
      transform: scale(1.1);
    }
  }

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.mode-icon {
  width: 28px;
  height: 28px;
  transition: all 0.2s;
}

.mode-name {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-primary);
}
</style>

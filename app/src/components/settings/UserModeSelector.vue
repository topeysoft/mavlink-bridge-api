<script setup lang="ts">
import { computed } from 'vue'
import { useFeaturesStore } from '@/stores/features'
import type { UserMode } from '@/stores/features'
import Card from '@/components/common/Card.vue'

const featuresStore = useFeaturesStore()

const modes: Array<{ value: UserMode; label: string; description: string; icon: string }> = [
  {
    value: 'consumer',
    label: 'Consumer Mode',
    description: 'Simple interface focused on common tasks like mowing, scheduling, and basic monitoring',
    icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2',
  },
  {
    value: 'power-user',
    label: 'Power User Mode',
    description: 'Advanced features including waypoint planning, telemetry charts, and system diagnostics',
    icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  },
  {
    value: 'developer',
    label: 'Developer Mode',
    description: 'Full access to MAVLink console, parameter editing, debug tools, and experimental features',
    icon: 'M16 18l2-2-2-2M8 6L6 8l2 2m4-10v20',
  },
]

const currentMode = computed(() => featuresStore.userMode)

function selectMode(mode: UserMode) {
  if (mode !== currentMode.value) {
    const modeLabel = modes.find(m => m.value === mode)?.label
    if (
      confirm(
        `Switch to ${modeLabel}?\n\nThis will change which features are available in the interface.`
      )
    ) {
      featuresStore.setUserMode(mode)
    }
  }
}

function getModeColor(mode: UserMode): string {
  switch (mode) {
    case 'consumer':
      return '#10b981'
    case 'power-user':
      return '#f59e0b'
    case 'developer':
      return '#ef4444'
    default:
      return '#6b7280'
  }
}
</script>

<template>
  <Card>
    <template #header>
      <div class="section-header">
        <div>
          <div class="card-title">User Mode</div>
          <div class="card-subtitle">Choose your experience level to show relevant features</div>
        </div>
        <div class="current-mode-badge" :style="{ borderColor: getModeColor(currentMode) }">
          <div class="mode-dot" :style="{ backgroundColor: getModeColor(currentMode) }"></div>
          {{ modes.find(m => m.value === currentMode)?.label }}
        </div>
      </div>
    </template>

    <div class="mode-grid">
      <div
        v-for="mode in modes"
        :key="mode.value"
        class="mode-card"
        :class="{ active: currentMode === mode.value }"
        @click="selectMode(mode.value)"
      >
        <div class="mode-icon" :style="{ backgroundColor: getModeColor(mode.value) }">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path :d="mode.icon" />
          </svg>
        </div>
        <div class="mode-content">
          <div class="mode-label">{{ mode.label }}</div>
          <div class="mode-description">{{ mode.description }}</div>
        </div>
        <div v-if="currentMode === mode.value" class="mode-check">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      </div>
    </div>

    <div class="mode-info">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
      <p>
        You can switch modes at any time. Advanced features will be hidden in Consumer Mode to keep the
        interface simple and focused.
      </p>
    </div>
  </Card>
</template>

<style scoped lang="scss">
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  width: 100%;
  padding: var(--spacing-lg);
}

.card-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.card-subtitle {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.current-mode-badge {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border: 2px solid;
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.mode-dot {
  width: 8px;
  height: 8px;
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

.mode-grid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: 0 var(--spacing-lg) var(--spacing-lg);
}

.mode-card {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: var(--bg-secondary);
  border: 2px solid var(--border-color);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s;
  position: relative;

  &:hover {
    background: var(--bg-tertiary);
    border-color: var(--primary-green);
    transform: translateX(4px);
  }

  &.active {
    border-color: var(--primary-green);
    background: rgba(44, 95, 45, 0.05);
    box-shadow: 0 4px 12px rgba(44, 95, 45, 0.1);
  }
}

.mode-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  color: white;
  flex-shrink: 0;

  svg {
    width: 24px;
    height: 24px;
  }
}

.mode-content {
  flex: 1;
  min-width: 0;
}

.mode-label {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.mode-description {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  line-height: 1.5;
}

.mode-check {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: var(--status-success);
  color: white;
  border-radius: 50%;
  flex-shrink: 0;

  svg {
    width: 14px;
    height: 14px;
  }
}

.mode-info {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  background: rgba(59, 130, 246, 0.05);
  border-top: 1px solid var(--border-color);
  color: var(--text-secondary);

  svg {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    color: #3b82f6;
    margin-top: 2px;
  }

  p {
    margin: 0;
    font-size: var(--font-size-sm);
    line-height: 1.6;
  }
}
</style>

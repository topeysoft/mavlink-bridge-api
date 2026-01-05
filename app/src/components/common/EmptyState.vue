<script setup lang="ts">
import Button from './Button.vue'

interface Props {
  icon?: string
  title: string
  message?: string
  actionLabel?: string
  secondaryActionLabel?: string
  variant?: 'default' | 'compact'
}

withDefaults(defineProps<Props>(), {
  variant: 'default'
})

const emit = defineEmits<{
  action: []
  secondaryAction: []
}>()
</script>

<template>
  <div class="empty-state" :class="`empty-state-${variant}`">
    <div class="empty-illustration">
      <slot name="icon">
        <!-- Missions/Box Icon -->
        <svg v-if="icon === 'box'" viewBox="0 0 200 200" fill="none">
          <rect x="50" y="60" width="100" height="80" rx="8" :stroke="'var(--primary-green)'" stroke-width="3" fill="var(--bg-secondary)"/>
          <path d="M50 80 L100 60 L150 80" :stroke="'var(--primary-green)'" stroke-width="3" fill="none"/>
          <line x1="100" y1="60" x2="100" y2="140" :stroke="'var(--primary-green)'" stroke-width="2" stroke-dasharray="4 4"/>
          <circle cx="100" cy="100" r="8" fill="var(--primary-green)" opacity="0.3"/>
        </svg>

        <!-- Map/Zones Icon -->
        <svg v-else-if="icon === 'map'" viewBox="0 0 200 200" fill="none">
          <path d="M100 30 C70 30 45 55 45 85 C45 115 100 160 100 160 S155 115 155 85 C155 55 130 30 100 30Z"
                :fill="'var(--sky-blue)'" opacity="0.2" :stroke="'var(--sky-blue)'" stroke-width="3"/>
          <circle cx="100" cy="85" r="15" :fill="'var(--sky-blue)'"/>
          <path d="M30 120 L80 100 L120 110 L170 95" :stroke="'var(--grass-green)'" stroke-width="3" fill="none" stroke-linecap="round"/>
        </svg>

        <!-- Search/Filter Icon -->
        <svg v-else-if="icon === 'search'" viewBox="0 0 200 200" fill="none">
          <circle cx="80" cy="80" r="35" :stroke="'var(--primary-green)'" stroke-width="3" fill="var(--bg-secondary)"/>
          <line x1="105" y1="105" x2="140" y2="140" :stroke="'var(--primary-green)'" stroke-width="3" stroke-linecap="round"/>
          <path d="M60 80 L80 95 L100 70" :stroke="'var(--status-success)'" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>

        <!-- Default Info Icon -->
        <svg v-else viewBox="0 0 200 200" fill="none">
          <circle cx="100" cy="100" r="50" :stroke="'var(--text-tertiary)'" stroke-width="3" fill="var(--bg-secondary)"/>
          <line x1="100" y1="90" x2="100" y2="120" :stroke="'var(--text-tertiary)'" stroke-width="3" stroke-linecap="round"/>
          <circle cx="100" cy="70" r="4" :fill="'var(--text-tertiary)'"/>
        </svg>
      </slot>
    </div>

    <div class="empty-content">
      <h3 class="empty-title">{{ title }}</h3>
      <p v-if="message" class="empty-message">{{ message }}</p>

      <div v-if="actionLabel || secondaryActionLabel" class="empty-actions">
        <Button v-if="actionLabel" variant="primary" @click="emit('action')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          {{ actionLabel }}
        </Button>
        <Button v-if="secondaryActionLabel" variant="outline" @click="emit('secondaryAction')">
          {{ secondaryActionLabel }}
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-3xl) var(--spacing-2xl);
  text-align: center;
  min-height: 400px;

  &.empty-state-compact {
    min-height: 300px;
    padding: var(--spacing-2xl);
  }
}

.empty-illustration {
  margin-bottom: var(--spacing-xl);
  animation: float 3s ease-in-out infinite;

  svg {
    width: 200px;
    height: 200px;
    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1));
  }

  .empty-state-compact & svg {
    width: 120px;
    height: 120px;
  }
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
}

.empty-content {
  max-width: 500px;
}

.empty-title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: var(--spacing-md);

  .empty-state-compact & {
    font-size: var(--font-size-xl);
  }
}

.empty-message {
  font-size: var(--font-size-base);
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: var(--spacing-xl);

  .empty-state-compact & {
    font-size: var(--font-size-sm);
    margin-bottom: var(--spacing-lg);
  }
}

.empty-actions {
  display: flex;
  gap: var(--spacing-md);
  justify-content: center;
  flex-wrap: wrap;
}
</style>

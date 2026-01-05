<script setup lang="ts">
interface TaskCardProps {
  title: string
  emoji: string
  description: string
  color?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<TaskCardProps>(), {
  color: 'var(--primary-green)',
  disabled: false
})

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    class="task-card"
    :class="{ disabled }"
    :style="{ '--task-color': color }"
    @click="emit('click')"
    :disabled="disabled"
  >
    <div class="task-emoji">{{ emoji }}</div>
    <div class="task-content">
      <div class="task-title">{{ title }}</div>
      <div class="task-description">{{ description }}</div>
    </div>
    <div class="task-arrow">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    </div>
  </button>
</template>

<style scoped lang="scss">
.task-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  padding: var(--spacing-xl);
  background: var(--bg-primary);
  border: 2px solid var(--border-color);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  text-align: left;
  width: 100%;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: var(--task-color);
    opacity: 0;
    transition: opacity 0.3s;
  }

  &:hover:not(.disabled) {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    border-color: var(--task-color);

    &::before {
      opacity: 1;
    }

    .task-arrow {
      transform: translateX(4px);
      color: var(--task-color);
    }
  }

  &:active:not(.disabled) {
    transform: translateY(-2px);
  }

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.task-emoji {
  font-size: 48px;
  line-height: 1;
  flex-shrink: 0;
}

.task-content {
  flex: 1;
  min-width: 0;
}

.task-title {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.task-description {
  font-size: var(--font-size-base);
  color: var(--text-secondary);
  line-height: 1.5;
}

.task-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  flex-shrink: 0;
  transition: all 0.3s;

  svg {
    width: 20px;
    height: 20px;
  }
}
</style>

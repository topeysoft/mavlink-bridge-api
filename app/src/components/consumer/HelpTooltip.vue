<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  content: string
  position?: 'top' | 'bottom' | 'left' | 'right'
}

withDefaults(defineProps<Props>(), {
  position: 'top'
})

const isVisible = ref(false)
</script>

<template>
  <div class="help-tooltip-wrapper">
    <button
      class="help-icon"
      @mouseenter="isVisible = true"
      @mouseleave="isVisible = false"
      @focus="isVisible = true"
      @blur="isVisible = false"
      type="button"
      aria-label="Help information"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
    </button>

    <Transition name="tooltip">
      <div v-if="isVisible" class="tooltip-content" :class="`position-${position}`">
        <div class="tooltip-arrow"></div>
        {{ content }}
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
.help-tooltip-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.help-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: help;
  padding: 0;
  transition: color 0.2s;

  &:hover,
  &:focus {
    color: var(--primary-green);
  }

  svg {
    width: 100%;
    height: 100%;
  }
}

.tooltip-content {
  position: absolute;
  z-index: 1000;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--text-primary);
  color: white;
  font-size: var(--font-size-sm);
  line-height: 1.5;
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-width: 250px;
  white-space: normal;
  pointer-events: none;

  &.position-top {
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);

    .tooltip-arrow {
      bottom: -4px;
      left: 50%;
      transform: translateX(-50%) rotate(45deg);
    }
  }

  &.position-bottom {
    top: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);

    .tooltip-arrow {
      top: -4px;
      left: 50%;
      transform: translateX(-50%) rotate(45deg);
    }
  }

  &.position-left {
    right: calc(100% + 8px);
    top: 50%;
    transform: translateY(-50%);

    .tooltip-arrow {
      right: -4px;
      top: 50%;
      transform: translateY(-50%) rotate(45deg);
    }
  }

  &.position-right {
    left: calc(100% + 8px);
    top: 50%;
    transform: translateY(-50%);

    .tooltip-arrow {
      left: -4px;
      top: 50%;
      transform: translateY(-50%) rotate(45deg);
    }
  }
}

.tooltip-arrow {
  position: absolute;
  width: 8px;
  height: 8px;
  background: var(--text-primary);
}

.tooltip-enter-active,
.tooltip-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-4px);

  &.position-bottom {
    transform: translateX(-50%) translateY(4px);
  }

  &.position-left {
    transform: translateY(-50%) translateX(4px);
  }

  &.position-right {
    transform: translateY(-50%) translateX(-4px);
  }
}
</style>

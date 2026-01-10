<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  title: string
  defaultExpanded?: boolean
  variant?: 'default' | 'subtle'
}

const props = withDefaults(defineProps<Props>(), {
  defaultExpanded: false,
  variant: 'default',
})

const isExpanded = ref(props.defaultExpanded)

const toggle = () => {
  isExpanded.value = !isExpanded.value
}
</script>

<template>
  <div class="collapsible" :class="`collapsible--${variant}`">
    <div class="collapsible-header" @click="toggle">
      <h4 class="collapsible-title">{{ title }}</h4>
      <svg
        class="chevron-icon"
        :class="{ expanded: isExpanded }"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </div>
    <transition name="expand">
      <div v-show="isExpanded" class="collapsible-content">
        <slot />
      </div>
    </transition>
  </div>
</template>

<style scoped lang="scss">
.collapsible {
  &--default {
    padding: var(--spacing-lg);
    background: var(--bg-secondary);
    border-radius: var(--border-radius-lg);
  }

  &--subtle {
    // No background/padding - just functionality
  }
}

.collapsible-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  user-select: none;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.8;
  }
}

.collapsible-title {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-primary);
}

.chevron-icon {
  width: 20px;
  height: 20px;
  color: var(--text-secondary);
  transition: transform 0.3s ease;
  flex-shrink: 0;

  &.expanded {
    transform: rotate(180deg);
  }
}

.collapsible-content {
  margin-top: var(--spacing-md);
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
  margin-top: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 500px;
  margin-top: var(--spacing-md);
}
</style>

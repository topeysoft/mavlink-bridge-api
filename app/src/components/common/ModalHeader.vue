<template>
  <div class="modal-header">
    <h2 class="modal-title">
      <slot />
    </h2>
    <button
      class="modal-close-btn"
      @click="$emit('close')"
      aria-label="Close"
      type="button"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
defineEmits<{
  (e: 'close'): void
}>()
</script>

<style scoped lang="scss">
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-lg) var(--spacing-xl);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.modal-title {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--text-primary);
}

.modal-close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--spacing-xs);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--border-radius);
  transition: all 0.2s;

  svg {
    width: 24px;
    height: 24px;
  }

  &:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  &:focus {
    outline: 2px solid var(--primary-green);
    outline-offset: 2px;
  }
}
</style>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="modal-overlay" @click="closeModal">
        <div class="modal-container" @click.stop>
          <div class="modal-header">
            <h2>Keyboard Shortcuts</h2>
            <button class="modal-close" @click="closeModal" aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div class="modal-body">
            <div class="shortcuts-grid">
              <div
                v-for="(shortcut, index) in shortcuts"
                :key="index"
                class="shortcut-item"
              >
                <div class="shortcut-keys">
                  <kbd
                    v-for="(key, i) in shortcut.keys.split(' + ')"
                    :key="i"
                    class="shortcut-key"
                  >
                    {{ key }}
                  </kbd>
                </div>
                <div class="shortcut-description">
                  {{ shortcut.description }}
                </div>
              </div>
            </div>

            <div class="modal-footer-note">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              Press <strong>?</strong> anytime to show this dialog
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
  shortcuts: Array<{ keys: string; description: string }>
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const closeModal = () => {
  emit('update:modelValue', false)
}
</script>

<style scoped lang="scss">
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: var(--spacing-lg);
}

.modal-container {
  background: var(--bg-primary);
  border-radius: var(--border-radius-lg);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 600px;
  width: 100%;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--border-color);

  h2 {
    margin: 0;
    font-size: var(--font-size-xl);
    color: var(--text-primary);
  }
}

.modal-close {
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
}

.modal-body {
  padding: var(--spacing-lg);
  overflow-y: auto;
}

.shortcuts-grid {
  display: grid;
  gap: var(--spacing-md);
}

.shortcut-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--border-radius);
  background: var(--bg-secondary);
  transition: background 0.2s;

  &:hover {
    background: var(--bg-tertiary);
  }
}

.shortcut-keys {
  display: flex;
  gap: 6px;
  align-items: center;
}

.shortcut-key {
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  min-width: 32px;
  text-align: center;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  box-shadow: 0 2px 0 var(--border-color);
  font-family: var(--font-family);
  color: var(--text-primary);
}

.shortcut-description {
  color: var(--text-primary);
  font-size: 14px;
}

.modal-footer-note {
  margin-top: var(--spacing-lg);
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);

  svg {
    flex-shrink: 0;
  }

  strong {
    color: var(--text-primary);
    font-weight: 600;
  }
}

// Transitions
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;

  .modal-container {
    transition: transform 0.3s ease;
  }
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;

  .modal-container {
    transform: scale(0.95) translateY(-20px);
  }
}
</style>

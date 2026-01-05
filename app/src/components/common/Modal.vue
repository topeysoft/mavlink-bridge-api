<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'

interface Props {
  modelValue: boolean
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  closeOnEscape?: boolean
  closeOnBackdrop?: boolean
  variant?: 'default' | 'danger' | 'success'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  closeOnEscape: true,
  closeOnBackdrop: true,
  variant: 'default'
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const modalContainer = ref<HTMLElement | null>(null)
const previousActiveElement = ref<HTMLElement | null>(null)

const close = () => {
  emit('update:modelValue', false)
}

const handleEscape = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.closeOnEscape && props.modelValue) {
    close()
  }
}

const handleBackdropClick = () => {
  if (props.closeOnBackdrop) {
    close()
  }
}

// Focus trap implementation
const handleTabKey = (e: KeyboardEvent) => {
  if (!props.modelValue || e.key !== 'Tab' || !modalContainer.value) return

  const focusableElements = modalContainer.value.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  const firstElement = focusableElements[0] as HTMLElement
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

  if (e.shiftKey) {
    if (document.activeElement === firstElement) {
      e.preventDefault()
      lastElement?.focus()
    }
  } else {
    if (document.activeElement === lastElement) {
      e.preventDefault()
      firstElement?.focus()
    }
  }
}

// Watch for modal open/close to manage focus
watch(() => props.modelValue, async (isOpen) => {
  if (isOpen) {
    previousActiveElement.value = document.activeElement as HTMLElement
    await nextTick()
    // Focus the first focusable element in the modal
    const firstFocusable = modalContainer.value?.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as HTMLElement
    firstFocusable?.focus()
    // Prevent body scroll
    document.body.style.overflow = 'hidden'
  } else {
    // Restore focus to previous element
    previousActiveElement.value?.focus()
    // Restore body scroll
    document.body.style.overflow = ''
  }
})

onMounted(() => {
  document.addEventListener('keydown', handleEscape)
  document.addEventListener('keydown', handleTabKey)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape)
  document.removeEventListener('keydown', handleTabKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="modal-overlay"
        @click="handleBackdropClick"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="title ? 'modal-title' : undefined"
      >
        <div
          ref="modalContainer"
          class="modal-container"
          :class="[`modal-${size}`, `modal-${variant}`]"
          @click.stop
        >
          <div class="modal-header">
            <slot name="header">
              <h2 v-if="title" id="modal-title" class="modal-title">{{ title }}</h2>
            </slot>
            <button class="modal-close" @click="close" aria-label="Close modal">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="modal-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--spacing-lg);
}

.modal-container {
  background: var(--bg-primary);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-xl);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  width: 100%;
}

.modal-sm {
  max-width: 400px;
}

.modal-md {
  max-width: 600px;
}

.modal-lg {
  max-width: 800px;
}

.modal-xl {
  max-width: 1200px;
}

.modal-full {
  max-width: 95vw;
  max-height: 95vh;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--border-color);

  .modal-title {
    font-size: var(--font-size-xl);
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }
}

.modal-close {
  background: none;
  border: none;
  padding: var(--spacing-sm);
  cursor: pointer;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--border-radius);
  transition: all 0.2s;

  svg {
    width: 20px;
    height: 20px;
  }

  &:hover {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }
}

.modal-body {
  padding: var(--spacing-lg);
  overflow-y: auto;
  flex: 1;
}

.modal-footer {
  padding: var(--spacing-lg);
  border-top: 1px solid var(--border-color);
  display: flex;
  gap: var(--spacing-md);
  justify-content: flex-end;
}

// Modal variants
.modal-danger {
  .modal-header {
    background: var(--status-danger);
    color: white;

    .modal-title {
      color: white;
    }

    .modal-close {
      color: white;

      &:hover {
        background: rgba(255, 255, 255, 0.2);
      }
    }
  }
}

.modal-success {
  .modal-header {
    background: var(--status-success);
    color: white;

    .modal-title {
      color: white;
    }

    .modal-close {
      color: white;

      &:hover {
        background: rgba(255, 255, 255, 0.2);
      }
    }
  }
}

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
    transform: scale(0.95);
  }
}
</style>

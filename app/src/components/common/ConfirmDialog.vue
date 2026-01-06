<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

interface Props {
  modelValue: boolean
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'danger' | 'warning' | 'success'
  icon?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Confirm',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  variant: 'default'
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'confirm': []
  'cancel': []
}>()

const confirmButton = ref<HTMLButtonElement | null>(null)

const handleConfirm = () => {
  emit('confirm')
  emit('update:modelValue', false)
}

const handleCancel = () => {
  emit('cancel')
  emit('update:modelValue', false)
}

const handleEscape = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.modelValue) {
    handleCancel()
  }
}

const handleEnter = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && props.modelValue && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    handleConfirm()
  }
}

watch(() => props.modelValue, async (isOpen) => {
  if (isOpen) {
    document.addEventListener('keydown', handleEscape)
    document.addEventListener('keydown', handleEnter)
    document.body.style.overflow = 'hidden'
    await nextTick()
    confirmButton.value?.focus()
  } else {
    document.removeEventListener('keydown', handleEscape)
    document.removeEventListener('keydown', handleEnter)
    document.body.style.overflow = ''
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div
        v-if="modelValue"
        class="dialog-overlay"
        @click="handleCancel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="title ? 'dialog-title' : undefined"
      >
        <div
          class="dialog-container"
          :class="`dialog-${variant}`"
          @click.stop
        >
          <div class="dialog-icon" v-if="icon">
            {{ icon }}
          </div>
          <div class="dialog-content">
            <h3 v-if="title" id="dialog-title" class="dialog-title">{{ title }}</h3>
            <p class="dialog-message" v-html="message.replace(/\n/g, '<br>')"></p>
          </div>
          <div class="dialog-actions">
            <button
              type="button"
              class="btn btn-secondary"
              @click="handleCancel"
            >
              {{ cancelText }}
            </button>
            <button
              ref="confirmButton"
              type="button"
              class="btn"
              :class="{
                'btn-danger': variant === 'danger',
                'btn-warning': variant === 'warning',
                'btn-primary': variant === 'default' || variant === 'success'
              }"
              @click="handleConfirm"
            >
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: var(--spacing-lg);
}

.dialog-container {
  background: var(--bg-primary);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 100%;
  padding: var(--spacing-xl);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.dialog-icon {
  font-size: 3rem;
  text-align: center;
}

.dialog-danger .dialog-icon {
  color: var(--status-danger);
}

.dialog-warning .dialog-icon {
  color: var(--status-warning);
}

.dialog-success .dialog-icon {
  color: var(--status-success);
}

.dialog-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.dialog-title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.dialog-message {
  font-size: var(--font-size-base);
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
}

.dialog-actions {
  display: flex;
  gap: var(--spacing-md);
  justify-content: flex-end;
  margin-top: var(--spacing-md);
}

.btn {
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: var(--radius-md);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  font-size: var(--font-size-base);

  &:focus {
    outline: 2px solid var(--primary-green);
    outline-offset: 2px;
  }
}

.btn-primary {
  background: var(--primary-green);
  color: white;

  &:hover {
    background: var(--primary-green-dark);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  &:active {
    transform: translateY(0);
  }
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);

  &:hover {
    background: var(--bg-secondary);
    border-color: var(--text-secondary);
  }
}

.btn-danger {
  background: var(--status-danger);
  color: white;

  &:hover {
    filter: brightness(0.9);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  &:active {
    transform: translateY(0);
  }
}

.btn-warning {
  background: var(--status-warning);
  color: var(--text-primary);

  &:hover {
    filter: brightness(0.9);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  &:active {
    transform: translateY(0);
  }
}

.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.2s ease;

  .dialog-container {
    transition: transform 0.2s ease;
  }
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;

  .dialog-container {
    transform: scale(0.95);
  }
}
</style>

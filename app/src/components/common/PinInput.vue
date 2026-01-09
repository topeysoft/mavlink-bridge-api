<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'

interface Props {
  modelValue: string
  length?: number // 4-6 digit PIN
  disabled?: boolean
  masked?: boolean
  autoSubmit?: boolean
  error?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  length: 4,
  disabled: false,
  masked: true,
  autoSubmit: true,
  error: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'complete': [value: string]
}>()

const inputRef = ref<HTMLInputElement>()
const internalValue = ref(props.modelValue || '')
const showMasked = ref(props.masked)

// Computed boxes for visual display
const boxes = computed(() => {
  const result = []
  for (let i = 0; i < props.length; i++) {
    result.push({
      digit: internalValue.value[i] || '',
      filled: i < internalValue.value.length,
      active: i === internalValue.value.length
    })
  }
  return result
})

// Display value (masked or not)
const displayDigit = (digit: string) => {
  if (!digit) return ''
  return showMasked.value ? '•' : digit
}

// Handle input changes
const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  let value = target.value.replace(/[^0-9]/g, '') // Only allow digits

  // Limit to specified length
  if (value.length > props.length) {
    value = value.slice(0, props.length)
  }

  internalValue.value = value
  emit('update:modelValue', value)

  // Auto-submit when complete
  if (props.autoSubmit && value.length === props.length) {
    emit('complete', value)
  }
}

// Handle paste
const handlePaste = (event: ClipboardEvent) => {
  event.preventDefault()
  const pastedData = event.clipboardData?.getData('text') || ''
  const digits = pastedData.replace(/[^0-9]/g, '').slice(0, props.length)

  internalValue.value = digits
  emit('update:modelValue', digits)

  if (props.autoSubmit && digits.length === props.length) {
    nextTick(() => {
      emit('complete', digits)
    })
  }
}

// Handle keydown for special keys
const handleKeydown = (event: KeyboardEvent) => {
  // Allow backspace, delete, arrow keys, tab
  const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab']
  if (allowedKeys.includes(event.key)) {
    return
  }

  // Only allow digit keys
  if (!/^[0-9]$/.test(event.key)) {
    event.preventDefault()
  }
}

// Focus input
const focus = () => {
  inputRef.value?.focus()
}

// Toggle masked state
const toggleMasked = () => {
  showMasked.value = !showMasked.value
}

// Clear input
const clear = () => {
  internalValue.value = ''
  emit('update:modelValue', '')
  focus()
}

// Watch for external value changes
watch(() => props.modelValue, (newVal) => {
  if (newVal !== internalValue.value) {
    internalValue.value = newVal || ''
  }
})

// Auto-focus on mount
onMounted(() => {
  if (!props.disabled) {
    focus()
  }
})

// Expose methods for parent components
defineExpose({
  focus,
  clear
})
</script>

<template>
  <div class="pin-input-wrapper">
    <div class="pin-boxes" :class="{ disabled, error }" @click="focus">
      <div
        v-for="(box, index) in boxes"
        :key="index"
        class="pin-box"
        :class="{
          filled: box.filled,
          active: box.active && !disabled,
          error
        }"
      >
        <span class="pin-digit">{{ displayDigit(box.digit) }}</span>
        <span v-if="box.active && !disabled" class="cursor"></span>
      </div>
    </div>

    <!-- Hidden actual input for accessibility and functionality -->
    <input
      ref="inputRef"
      type="text"
      inputmode="numeric"
      autocomplete="one-time-code"
      :pattern="`[0-9]{${length}}`"
      :maxlength="length"
      :value="internalValue"
      :disabled="disabled"
      class="pin-input-hidden"
      aria-label="Enter PIN"
      @input="handleInput"
      @paste="handlePaste"
      @keydown="handleKeydown"
    />

    <!-- Toggle visibility button -->
    <button
      type="button"
      class="toggle-visibility"
      @click="toggleMasked"
      :title="showMasked ? 'Show PIN' : 'Hide PIN'"
      :disabled="disabled"
    >
      <svg v-if="showMasked" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </svg>
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    </button>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.pin-input-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  align-items: center;
}

.pin-boxes {
  display: flex;
  gap: var(--spacing-md);
  justify-content: center;
  cursor: text;
  user-select: none;

  &.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.pin-box {
  position: relative;
  width: 56px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  transition: all 0.2s ease;
  font-size: 2rem;
  font-weight: 600;
  color: var(--text-primary);

  &.filled {
    border-color: $primary;
    background: rgba($primary, 0.05);
  }

  &.active {
    border-color: $primary;
    box-shadow: 0 0 0 3px rgba($primary, 0.1);
    animation: pulse-border 2s ease-in-out infinite;
  }

  &.error {
    border-color: var(--status-danger);
    animation: shake 0.4s ease-in-out;

    &.filled {
      background: rgba(220, 53, 69, 0.05);
    }
  }
}

.pin-digit {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1;
}

.cursor {
  position: absolute;
  width: 2px;
  height: 32px;
  background: $primary;
  animation: blink 1s step-end infinite;
}

.pin-input-hidden {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.toggle-visibility {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-sm);
  background: none;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;

  svg {
    width: 20px;
    height: 20px;
  }

  &:hover:not(:disabled) {
    background: var(--bg-secondary);
    color: $primary;
    border-color: $primary;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:active:not(:disabled) {
    transform: scale(0.95);
  }
}

@keyframes blink {
  0%, 50% {
    opacity: 1;
  }
  51%, 100% {
    opacity: 0;
  }
}

@keyframes pulse-border {
  0%, 100% {
    box-shadow: 0 0 0 3px rgba($primary, 0.1);
  }
  50% {
    box-shadow: 0 0 0 3px rgba($primary, 0.2);
  }
}

@keyframes shake {
  0%, 100% {
    transform: translateX(0);
  }
  10%, 30%, 50%, 70%, 90% {
    transform: translateX(-4px);
  }
  20%, 40%, 60%, 80% {
    transform: translateX(4px);
  }
}

// Mobile optimization
@media (max-width: 640px) {
  .pin-box {
    width: 48px;
    height: 56px;
    font-size: 1.75rem;
  }

  .pin-digit {
    font-size: 1.75rem;
  }

  .cursor {
    height: 28px;
  }

  .pin-boxes {
    gap: var(--spacing-sm);
  }
}

// Small mobile screens
@media (max-width: 380px) {
  .pin-box {
    width: 44px;
    height: 52px;
    font-size: 1.5rem;
  }

  .pin-digit {
    font-size: 1.5rem;
  }

  .cursor {
    height: 24px;
  }

  .pin-boxes {
    gap: var(--spacing-xs);
  }
}
</style>

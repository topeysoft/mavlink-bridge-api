<template>
  <q-btn
    unelevated
    :color="buttonColor"
    :text-color="textColor"
    :icon="action.icon"
    :disable="action.disabled"
    class="quick-action-button"
    :class="{
      'quick-action-button--urgent': action.urgent,
      'quick-action-button--disabled': action.disabled
    }"
    @click="handleClick"
  >
    <!-- Badge -->
    <q-badge
      v-if="action.badge"
      floating
      rounded
      :label="action.badge"
      color="negative"
      class="quick-action-button__badge"
    />

    <!-- Button Content -->
    <div class="quick-action-button__content">
      <div class="quick-action-button__label">
        {{ action.label }}
      </div>
      <div v-if="action.description" class="quick-action-button__description">
        {{ action.description }}
      </div>
    </div>
  </q-btn>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useQuasar } from 'quasar'

// Types
interface QuickAction {
  id: string
  label: string
  description?: string
  icon: string
  color?: string
  urgent?: boolean
  disabled?: boolean
  badge?: string | number
  requiresConfirmation?: boolean
}

interface Props {
  action: QuickAction
}

const props = defineProps<Props>()

// Emits
defineEmits<{
  click: []
}>()

// Composables
const $q = useQuasar()

// Computed properties
const buttonColor = computed(() => {
  if (props.action.disabled) return 'grey-4'
  if (props.action.urgent) return 'negative'
  return props.action.color || 'primary'
})

const textColor = computed(() => {
  if (props.action.disabled) return 'grey-6'
  return 'white'
})

// Methods
const handleClick = async () => {
  if (props.action.disabled) return

  if (props.action.requiresConfirmation) {
    const confirmed = await showConfirmation()
    if (!confirmed) return
  }

  // emit('click');
}

const showConfirmation = async (): Promise<boolean> => {
  return new Promise(resolve => {
    $q.dialog({
      title: 'Confirm Action',
      message: `Are you sure you want to ${props.action.label.toLowerCase()}?`,
      cancel: true,
      persistent: true,
      color: props.action.urgent ? 'negative' : 'primary'
    })
      .onOk(() => resolve(true))
      .onCancel(() => resolve(false))
  })
}
</script>

<style lang="scss" scoped>
.quick-action-button {
  position: relative;
  padding: 16px 12px;
  border-radius: 12px;
  min-height: 80px;
  transition: all 0.2s ease;

  &:hover:not(.quick-action-button--disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  }

  &--urgent {
    animation: pulse 2s infinite;
  }

  &--disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  :deep(.q-btn__content) {
    flex-direction: column;
    gap: 4px;
  }

  :deep(.q-icon) {
    font-size: 24px;
    margin-bottom: 4px;
  }
}

.quick-action-button__badge {
  z-index: 1;
}

.quick-action-button__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  width: 100%;
}

.quick-action-button__label {
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.2;
  margin-bottom: 2px;
}

.quick-action-button__description {
  font-size: 0.7rem;
  opacity: 0.8;
  line-height: 1.2;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// Urgent pulse animation
@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(var(--q-negative-rgb), 0.7);
  }
  70% {
    box-shadow: 0 0 0 8px rgba(var(--q-negative-rgb), 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(var(--q-negative-rgb), 0);
  }
}

// Responsive adjustments
@media (max-width: 599px) {
  .quick-action-button {
    padding: 12px 8px;
    min-height: 70px;
  }

  .quick-action-button__label {
    font-size: 0.8rem;
  }

  .quick-action-button__description {
    font-size: 0.65rem;
  }

  :deep(.q-icon) {
    font-size: 20px;
  }
}

// Focus styles
.quick-action-button:focus-visible {
  outline: 2px solid var(--q-primary);
  outline-offset: 2px;
}
</style>

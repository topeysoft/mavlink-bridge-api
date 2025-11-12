<template>
  <q-card
    class="quick-action-card"
    :class="{
      'quick-action-card--urgent': action.urgent,
      'quick-action-card--disabled': action.disabled
    }"
    clickable
    @click="handleClick"
  >
    <q-card-section class="quick-action-card__content">
      <!-- Icon -->
      <div class="quick-action-card__icon-container">
        <q-icon
          :name="action.icon"
          :color="action.disabled ? 'grey-5' : action.color || 'primary'"
          size="28px"
          class="quick-action-card__icon"
        />

        <!-- Urgent indicator -->
        <q-badge
          v-if="action.urgent && !action.disabled"
          color="negative"
          floating
          rounded
          class="quick-action-card__urgent-badge"
        >
          !
        </q-badge>
      </div>

      <!-- Content -->
      <div class="quick-action-card__text">
        <div class="quick-action-card__label">
          {{ action.label }}
        </div>

        <div v-if="action.description" class="quick-action-card__description">
          {{ action.description }}
        </div>
      </div>
    </q-card-section>

    <!-- Loading overlay -->
    <q-inner-loading :showing="loading" color="primary">
      <q-spinner size="24px" />
    </q-inner-loading>
  </q-card>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useQuasar } from 'quasar'

// Types
interface QuickAction {
  id: string
  label: string
  description?: string
  icon: string
  color?: string
  category: string
  urgent?: boolean
  disabled?: boolean
  requiresConfirmation?: boolean
  timestamp?: string
}

// Props
const props = defineProps<{
  action: QuickAction
}>()

// Emits
const emit = defineEmits<{
  click: [action: QuickAction]
}>()

// Composables
const $q = useQuasar()

// Local state
const loading = ref(false)

// Methods
const handleClick = async () => {
  if (props.action.disabled) {
    return
  }

  if (props.action.requiresConfirmation) {
    const confirmed = await $q
      .dialog({
        title: 'Confirm Action',
        message: `Are you sure you want to ${props.action.label.toLowerCase()}?`,
        cancel: true,
        persistent: true,
        color: props.action.urgent ? 'negative' : 'primary'
      })
      .onOk(() => true)
      .onCancel(() => false)

    if (!confirmed) {
      return
    }
  }

  loading.value = true

  try {
    // Simulate action delay
    await new Promise(resolve => globalThis.setTimeout(resolve, 500))

    emit('click', props.action)

    $q.notify({
      type: 'positive',
      message: `${props.action.label} executed successfully`,
      position: 'top'
    })
  } catch {
    $q.notify({
      type: 'negative',
      message: `Failed to execute ${props.action.label}`,
      position: 'top'
    })
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.quick-action-card {
  position: relative;
  transition: all 0.2s ease;
  border: 1px solid rgba(0, 0, 0, 0.12);
  cursor: pointer;

  .body--dark & {
    border-color: rgba(255, 255, 255, 0.12);
  }

  &:hover:not(.quick-action-card--disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

    .body--dark & {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
  }

  &--urgent {
    border-color: var(--q-negative);
    background: linear-gradient(
      135deg,
      rgba(var(--q-negative-rgb), 0.05) 0%,
      rgba(var(--q-negative-rgb), 0.02) 100%
    );

    &:hover {
      border-color: var(--q-negative);
      box-shadow: 0 4px 12px rgba(var(--q-negative-rgb), 0.2);
    }
  }

  &--disabled {
    opacity: 0.6;
    cursor: not-allowed;

    &:hover {
      transform: none;
      box-shadow: none;
    }
  }
}

.quick-action-card__content {
  padding: 16px;
  text-align: center;
  min-height: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.quick-action-card__icon-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.quick-action-card__icon {
  display: block;
}

.quick-action-card__urgent-badge {
  font-size: 10px;
  font-weight: bold;
  animation: pulse 1.5s ease-in-out infinite;
}

.quick-action-card__text {
  flex: 1;
  width: 100%;
}

.quick-action-card__label {
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.2;
  color: var(--q-dark);
  margin-bottom: 4px;

  .body--dark & {
    color: var(--q-dark-page-text);
  }

  .quick-action-card--disabled & {
    color: var(--q-grey-6);
  }
}

.quick-action-card__description {
  font-size: 0.75rem;
  line-height: 1.3;
  color: var(--q-grey-7);

  .body--dark & {
    color: var(--q-grey-5);
  }

  .quick-action-card--disabled & {
    color: var(--q-grey-5);
  }
}

// Animations
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

// Responsive adjustments
@media (max-width: 479px) {
  .quick-action-card__content {
    padding: 12px;
    min-height: 80px;
    gap: 8px;
  }

  .quick-action-card__icon {
    font-size: 24px !important;
  }

  .quick-action-card__label {
    font-size: 0.8rem;
  }

  .quick-action-card__description {
    font-size: 0.7rem;
  }
}
</style>

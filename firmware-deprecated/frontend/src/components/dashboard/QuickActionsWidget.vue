<template>
  <q-card flat bordered class="quick-actions-widget">
    <q-card-section class="quick-actions-widget__header">
      <h3 class="quick-actions-widget__title">Quick Actions</h3>
      <p class="quick-actions-widget__subtitle">Common tasks and controls</p>
    </q-card-section>

    <q-separator />

    <!-- Actions Grid -->
    <q-card-section class="quick-actions-widget__content">
      <div class="quick-actions-grid">
        <QuickActionButton
          v-for="action in actions"
          :key="action.id"
          :action="action"
          @click="$emit('action', action.id)"
        />
      </div>

      <!-- Custom Action Button -->
      <div class="quick-actions-widget__custom">
        <q-btn
          flat
          icon="add"
          label="Custom Action"
          color="primary"
          class="full-width"
          @click="$emit('custom-action')"
        />
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
// Components
import QuickActionButton from './QuickActionButton.vue'

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
  actions: QuickAction[]
}

defineProps<Props>()

// Emits
defineEmits<{
  action: [actionId: string]
  'custom-action': []
}>()
</script>

<style lang="scss" scoped>
.quick-actions-widget {
  border-radius: 12px;
}

.quick-actions-widget__header {
  padding: 20px 24px 16px;
}

.quick-actions-widget__title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 4px 0;
  color: var(--q-dark);

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

.quick-actions-widget__subtitle {
  font-size: 0.875rem;
  color: var(--q-grey-7);
  margin: 0;
}

.quick-actions-widget__content {
  padding: 0 24px 24px;
}

.quick-actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.quick-actions-widget__custom {
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  padding-top: 16px;

  .body--dark & {
    border-top-color: rgba(255, 255, 255, 0.05);
  }
}

// Responsive adjustments
@media (max-width: 1023px) {
  .quick-actions-widget__header {
    padding: 16px 20px 12px;
  }

  .quick-actions-widget__content {
    padding: 0 20px 20px;
  }

  .quick-actions-grid {
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 10px;
  }
}

@media (max-width: 599px) {
  .quick-actions-widget__header {
    padding: 12px 16px;
  }

  .quick-actions-widget__content {
    padding: 0 16px 16px;
  }

  .quick-actions-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
}
</style>

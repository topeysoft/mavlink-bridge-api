<script setup lang="ts">
import { ref } from 'vue'
import Button from '@/components/common/Button.vue'
import FormSelect from '@/components/common/FormSelect.vue'

const emit = defineEmits<{
  createMission: []
  toggleView: [view: 'grid' | 'calendar']
  filterStatus: [status: string]
  export: []
}>()

const selectedStatus = ref('all')
const currentView = ref<'grid' | 'calendar'>('grid')

const statusOptions = [
  { value: 'all', label: 'All Missions' },
  { value: 'active', label: 'Active' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' }
]

const handleStatusChange = () => {
  emit('filterStatus', selectedStatus.value)
}

const toggleView = () => {
  currentView.value = currentView.value === 'grid' ? 'calendar' : 'grid'
  emit('toggleView', currentView.value)
}
</script>

<template>
  <div class="missions-toolbar">
    <div class="toolbar-actions">
      <Button variant="primary" @click="emit('createMission')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Create Mission
      </Button>
      <Button variant="outline" @click="emit('export')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        Export
      </Button>
    </div>
    <div class="toolbar-filters">
      <FormSelect
        v-model="selectedStatus"
        :options="statusOptions"
        @update:modelValue="handleStatusChange"
      />
      <button class="view-toggle" @click="toggleView">
        <svg v-if="currentView === 'grid'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.missions-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xl);
  padding: var(--spacing-lg);
  background: var(--bg-primary);
  border-radius: var(--border-radius);
  border: 1px solid var(--border-color);
}

.toolbar-actions {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;

  svg {
    width: 16px;
    height: 16px;
  }
}

.toolbar-filters {
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
}

.view-toggle {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  padding: var(--spacing-sm);
  border-radius: var(--border-radius);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  color: var(--text-secondary);

  svg {
    width: 18px;
    height: 18px;
  }

  &:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }
}
</style>

<script setup lang="ts">
import { ref } from 'vue'
import Button from '@/components/common/Button.vue'
import FormInput from '@/components/common/FormInput.vue'
import FormSelect from '@/components/common/FormSelect.vue'

const emit = defineEmits<{
  createZone: []
  recordZone: []
  import: []
  export: []
  search: [query: string]
  filterType: [type: string]
}>()

const searchQuery = ref('')
const selectedType = ref('all')

const zoneTypes = [
  { value: 'all', label: 'All Types' },
  { value: 'lawn', label: 'Lawn' },
  { value: 'garden', label: 'Garden' },
  { value: 'path', label: 'Path' },
  { value: 'no-go', label: 'No-Go Zone' }
]

const handleSearch = () => {
  emit('search', searchQuery.value)
}

const handleFilterChange = () => {
  emit('filterType', selectedType.value)
}
</script>

<template>
  <div class="zones-toolbar">
    <div class="toolbar-actions">
      <Button variant="primary" @click="emit('createZone')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Create Zone
      </Button>
      <Button variant="accent" @click="emit('recordZone')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        📍 Record Zone
      </Button>
      <Button variant="outline" @click="emit('import')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        Import
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
      <div class="search-input">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search zones..."
          @input="handleSearch"
        />
      </div>
      <FormSelect
        v-model="selectedType"
        :options="zoneTypes"
        @update:modelValue="handleFilterChange"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.zones-toolbar {
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

.search-input {
  position: relative;
  display: flex;
  align-items: center;

  svg {
    position: absolute;
    left: var(--spacing-sm);
    width: 18px;
    height: 18px;
    color: var(--text-secondary);
    pointer-events: none;
  }

  input {
    padding: var(--spacing-sm) var(--spacing-md) var(--spacing-sm) 2.5rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    min-width: 200px;

    &:focus {
      outline: none;
      border-color: var(--primary-green);
      box-shadow: 0 0 0 3px var(--primary-green-light);
    }
  }
}
</style>

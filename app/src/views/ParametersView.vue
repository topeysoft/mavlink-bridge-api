<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useParametersStore } from '@/stores/parameters'
import { useNotifications } from '@/composables/useNotifications'
import ParameterGroupList from '@/components/parameters/ParameterGroupList.vue'
import Modal from '@/components/common/Modal.vue'

const { success, error, info, warning } = useNotifications()
const parametersStore = useParametersStore()

// Search and filter
const searchQuery = ref('')
const selectedGroup = ref<string | null>(null)
const showModifiedOnly = ref(false)

// Dialogs
const showSaveSetDialog = ref(false)
const showLoadSetDialog = ref(false)
const showConfirmDialog = ref(false)
const confirmDialogConfig = ref<{
  title: string
  message: string
  onConfirm: () => void
}>({
  title: '',
  message: '',
  onConfirm: () => {},
})

const newSetName = ref('')
const newSetDescription = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

// Watch filters and update store
watch([searchQuery, selectedGroup, showModifiedOnly], () => {
  parametersStore.setFilter({
    search: searchQuery.value,
    group: selectedGroup.value || undefined,
    modifiedOnly: showModifiedOnly.value,
  })
})

// Computed
const groupOptions = computed(() => {
  const groups = new Set(parametersStore.parameters.map(p => p.group))
  return Array.from(groups).sort()
})

const formatLastSync = computed(() => {
  if (!parametersStore.lastSync) return ''
  const date = new Date(parametersStore.lastSync)
  return date.toLocaleString()
})

// Actions
async function handleRefresh() {
  try {
    const isSuccess = await parametersStore.loadParametersFromVehicle()
    if (isSuccess) {
      success(`Loaded ${parametersStore.parameterCount} parameters from vehicle`)
    }
  } catch (err) {
    console.error('Failed to load parameters:', err)
    error(`Failed to load parameters: ${err instanceof Error ? err.message : 'Unknown error'}`)
  }
}

async function handleSaveToVehicle() {
  const validation = parametersStore.validateParameters(parametersStore.modifiedParameters)

  if (!validation.valid) {
    error(`Validation failed: ${validation.errors.join(', ')}`)
    return
  }

  if (validation.warnings.length > 0) {
    confirmDialogConfig.value = {
      title: 'Warning',
      message: validation.warnings.join('\n'),
      onConfirm: async () => {
        await saveToVehicle()
        showConfirmDialog.value = false
      },
    }
    showConfirmDialog.value = true
  } else {
    await saveToVehicle()
  }
}

async function saveToVehicle() {
  const count = parametersStore.modifiedCount
  const isSuccess = await parametersStore.saveParametersToVehicle()
  if (isSuccess) {
    success(`Saved ${count} parameters to vehicle`)
  } else {
    error('Failed to save parameters to vehicle')
  }
}

function handleResetAll() {
  confirmDialogConfig.value = {
    title: 'Reset All Parameters',
    message: 'Are you sure you want to reset all modified parameters to their default values?',
    onConfirm: () => {
      parametersStore.resetAllParameters()
      info('All parameters reset to defaults')
      showConfirmDialog.value = false
    },
  }
  showConfirmDialog.value = true
}

function handleSaveSet() {
  if (!newSetName.value) return

  const set = parametersStore.saveParameterSet(newSetName.value, newSetDescription.value)
  success(`Parameter set "${set.name}" saved`)

  newSetName.value = ''
  newSetDescription.value = ''
  showSaveSetDialog.value = false
}

function handleLoadSet(setId: string) {
  const isSuccess = parametersStore.loadParameterSet(setId)
  if (isSuccess) {
    success('Parameter set loaded')
    showLoadSetDialog.value = false
  }
}

function handleDeleteSet(setId: string) {
  confirmDialogConfig.value = {
    title: 'Delete Parameter Set',
    message: 'Are you sure you want to delete this parameter set?',
    onConfirm: () => {
      parametersStore.deleteParameterSet(setId)
      info('Parameter set deleted')
      showConfirmDialog.value = false
    },
  }
  showConfirmDialog.value = true
}

function handleExportSet(set: any) {
  parametersStore.exportParameterSet(set)
  success(`Exported parameter set "${set.name}"`)
}

function handleImportSet() {
  fileInput.value?.click()
}

async function handleFileSelected(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  try {
    const content = await file.text()
    const set = parametersStore.importParameterSet(content)

    if (set) {
      success(`Imported parameter set "${set.name}"`)
    } else {
      error('Failed to import parameter set')
    }
  } catch (err) {
    console.error('Import error:', err)
    error('Failed to read file')
  }

  // Reset input
  target.value = ''
}

// Don't auto-load parameters on mount - wait for user to click refresh
// This prevents unnecessary loading and allows streaming to handle updates
onMounted(() => {
  console.log('Parameters view mounted with', parametersStore.parameterCount, 'parameters')
})
</script>

<template>
  <div class="parameters-view">
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">
          <svg viewBox="0 0 24 24" fill="currentColor" class="title-icon">
            <path
              d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"
            />
          </svg>
          Parameters
        </h1>
        <p class="page-subtitle">Configure vehicle parameters and save settings</p>
      </div>
      <div class="header-actions">
        <button
          class="btn btn-icon"
          :disabled="parametersStore.isLoadingParameters"
          @click="handleRefresh"
          title="Refresh from vehicle"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            :class="{ spinning: parametersStore.isLoadingParameters }"
          >
            <path
              d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"
            />
          </svg>
        </button>
        <button
          class="btn btn-primary"
          :disabled="parametersStore.modifiedCount === 0"
          @click="handleSaveToVehicle"
          title="Save to vehicle"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          <span>Save</span>
          <span v-if="parametersStore.modifiedCount > 0" class="badge">
            {{ parametersStore.modifiedCount }}
          </span>
        </button>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="parameters-toolbar">
      <div class="toolbar-left">
        <div class="search-input">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search parameters..."
            class="input"
          />
          <button v-if="searchQuery" class="clear-btn" @click="searchQuery = ''">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <select v-model="selectedGroup" class="select">
          <option :value="null">All groups</option>
          <option v-for="group in groupOptions" :key="group" :value="group">{{ group }}</option>
        </select>

        <label class="checkbox-label">
          <input v-model="showModifiedOnly" type="checkbox" class="checkbox" />
          <span>Modified only</span>
        </label>
      </div>

      <div class="toolbar-right">
        <button class="btn btn-secondary" @click="showLoadSetDialog = true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 002-2v-4M17 9l-5 5-5-5M12 12.8V2.5" />
          </svg>
          <span>Load Set</span>
        </button>
        <button class="btn btn-secondary" @click="showSaveSetDialog = true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
          </svg>
          <span>Save Set</span>
        </button>
        <button
          class="btn btn-secondary"
          :disabled="parametersStore.modifiedCount === 0"
          @click="handleResetAll"
          title="Reset all to defaults"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          <span>Reset All</span>
        </button>
      </div>
    </div>

    <!-- Info Bar -->
    <div v-if="parametersStore.lastSync" class="info-bar">
      <div class="info-item">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" fill="none" stroke="white" stroke-width="2" />
        </svg>
        <span>Last synced: {{ formatLastSync }}</span>
      </div>
      <div class="info-item">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          />
        </svg>
        <span>{{ parametersStore.parameterCount }} parameters</span>
      </div>
      <div v-if="parametersStore.modifiedCount > 0" class="info-item modified">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" />
          <path
            d="M20.71 7.04a.996.996 0 000-1.41l-2.34-2.34a.996.996 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
          />
        </svg>
        <span>{{ parametersStore.modifiedCount }} modified</span>
      </div>
    </div>

    <!-- Parameter Groups -->
    <div v-if="parametersStore.isLoadingParameters" class="loading-container">
      <div class="spinner"></div>
      <p>Loading parameters from vehicle...</p>
    </div>

    <div v-else-if="parametersStore.parameterCount === 0" class="empty-state">
      <svg viewBox="0 0 24 24" fill="currentColor" class="empty-icon">
        <path
          d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"
        />
      </svg>
      <h3>No Parameters Loaded</h3>
      <p>Click the refresh button to load parameters from the vehicle</p>
      <button class="btn btn-primary" @click="handleRefresh">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path
            d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"
          />
        </svg>
        <span>Load Parameters</span>
      </button>
    </div>

    <div v-else class="parameters-container">
      <ParameterGroupList :groups="parametersStore.filteredGroups" />
    </div>

    <!-- Save Parameter Set Dialog -->
    <Modal v-model="showSaveSetDialog" title="Save Parameter Set" size="md">
      <div class="form-group">
        <label for="set-name">Set Name</label>
        <input
          id="set-name"
          v-model="newSetName"
          type="text"
          class="input"
          placeholder="Enter set name"
          @keyup.enter="handleSaveSet"
        />
      </div>
      <div class="form-group">
        <label for="set-description">Description (optional)</label>
        <textarea
          id="set-description"
          v-model="newSetDescription"
          class="textarea"
          placeholder="Enter description"
          rows="3"
        ></textarea>
      </div>

      <template #footer>
        <button class="btn btn-secondary" @click="showSaveSetDialog = false">Cancel</button>
        <button class="btn btn-primary" :disabled="!newSetName" @click="handleSaveSet">
          Save
        </button>
      </template>
    </Modal>

    <!-- Load Parameter Set Dialog -->
    <Modal v-model="showLoadSetDialog" title="Load Parameter Set" size="md">
      <div v-if="parametersStore.parameterSets.length === 0" class="empty-sets">
        <svg viewBox="0 0 24 24" fill="currentColor" class="empty-icon">
          <path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 002-2v-4M17 9l-5 5-5-5M12 12.8V2.5" />
        </svg>
        <p>No saved parameter sets</p>
      </div>

      <div v-else class="parameter-sets-list">
        <div
          v-for="set in parametersStore.parameterSets"
          :key="set.id"
          class="parameter-set-item"
          @click="handleLoadSet(set.id)"
        >
          <div class="set-info">
            <div class="set-name">{{ set.name }}</div>
            <div class="set-description">{{ set.description || 'No description' }}</div>
            <div class="set-meta">Created: {{ new Date(set.created).toLocaleDateString() }}</div>
          </div>
          <div class="set-actions">
            <button class="btn-icon" @click.stop="handleExportSet(set)" title="Export">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
            </button>
            <button
              class="btn-icon danger"
              @click.stop="handleDeleteSet(set.id)"
              title="Delete"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <template #footer>
        <button class="btn btn-secondary" @click="handleImportSet">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 002-2v-4M17 9l-5 5-5-5M12 12.8V2.5" />
          </svg>
          <span>Import from File</span>
        </button>
        <button class="btn btn-secondary" @click="showLoadSetDialog = false">Close</button>
      </template>
    </Modal>

    <!-- Confirm Dialog -->
    <Modal
      v-model="showConfirmDialog"
      :title="confirmDialogConfig.title"
      size="sm"
      variant="danger"
    >
      <p>{{ confirmDialogConfig.message }}</p>
      <template #footer>
        <button class="btn btn-secondary" @click="showConfirmDialog = false">Cancel</button>
        <button class="btn btn-danger" @click="confirmDialogConfig.onConfirm">Confirm</button>
      </template>
    </Modal>

    <!-- Hidden file input for import -->
    <input
      ref="fileInput"
      type="file"
      accept=".params,.json"
      style="display: none"
      @change="handleFileSelected"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/mixins' as *;

.parameters-view {
  padding: var(--spacing-xl);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-xl);

  .header-content {
    .page-title {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      margin: 0 0 var(--spacing-sm) 0;
      font-size: var(--font-size-2xl);
      font-weight: 600;
      color: var(--primary-green);

      .title-icon {
        width: 36px;
        height: 36px;
      }
    }

    .page-subtitle {
      margin: 0;
      color: var(--text-secondary);
      font-size: var(--font-size-base);
    }
  }

  .header-actions {
    display: flex;
    gap: var(--spacing-md);
  }
}

.parameters-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-lg);
  background: var(--bg-primary);
  border-radius: var(--border-radius);
  margin-bottom: var(--spacing-lg);
  box-shadow: var(--shadow-sm);

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: var(--spacing-lg);
    flex: 1;
  }

  .toolbar-right {
    display: flex;
    gap: var(--spacing-md);
  }
}

.search-input {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  max-width: 400px;

  svg {
    position: absolute;
    left: var(--spacing-md);
    width: 20px;
    height: 20px;
    color: var(--text-tertiary);
  }

  .input {
    padding-left: calc(var(--spacing-md) + 20px + var(--spacing-sm));
    padding-right: var(--spacing-xl);
  }

  .clear-btn {
    position: absolute;
    right: var(--spacing-sm);
    background: none;
    border: none;
    cursor: pointer;
    padding: var(--spacing-xs);
    color: var(--text-tertiary);
    display: flex;
    align-items: center;
    border-radius: var(--border-radius-sm);

    svg {
      position: static;
      width: 16px;
      height: 16px;
    }

    &:hover {
      background: var(--bg-secondary);
      color: var(--text-primary);
    }
  }
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  cursor: pointer;
  user-select: none;
  color: var(--text-primary);
}

.info-bar {
  display: flex;
  gap: var(--spacing-xl);
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--bg-secondary);
  border-radius: var(--border-radius);
  margin-bottom: var(--spacing-lg);

  .info-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);

    svg {
      width: 18px;
      height: 18px;
    }

    &.modified {
      color: var(--status-warning);
      font-weight: 500;
    }
  }
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: calc(var(--spacing-xl) * 3) var(--spacing-xl);
  gap: var(--spacing-lg);

  p {
    color: var(--text-secondary);
    margin: 0;
  }
}

.empty-state {
  @include card;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: calc(var(--spacing-xl) * 3) var(--spacing-xl);
  gap: var(--spacing-lg);
  text-align: center;

  .empty-icon {
    width: 64px;
    height: 64px;
    color: var(--text-tertiary);
  }

  h3 {
    margin: 0;
    color: var(--text-primary);
    font-size: var(--font-size-xl);
  }

  p {
    margin: 0;
    color: var(--text-secondary);
  }
}

.parameters-container {
  @include card;
}

.form-group {
  margin-bottom: var(--spacing-lg);

  label {
    display: block;
    margin-bottom: var(--spacing-sm);
    color: var(--text-primary);
    font-weight: 500;
  }

  .input,
  .textarea {
    width: 100%;
  }
}

.empty-sets {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  padding: calc(var(--spacing-xl) * 2);
  text-align: center;

  .empty-icon {
    width: 48px;
    height: 48px;
    color: var(--text-tertiary);
  }

  p {
    margin: 0;
    color: var(--text-secondary);
  }
}

.parameter-sets-list {
  max-height: 400px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.parameter-set-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-lg);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--bg-secondary);
    border-color: var(--primary-green);
  }

  .set-info {
    flex: 1;

    .set-name {
      font-weight: 500;
      color: var(--text-primary);
      margin-bottom: var(--spacing-xs);
    }

    .set-description {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      margin-bottom: var(--spacing-xs);
    }

    .set-meta {
      font-size: var(--font-size-xs);
      color: var(--text-tertiary);
    }
  }

  .set-actions {
    display: flex;
    gap: var(--spacing-sm);
  }
}

.btn-icon {
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

  &.danger:hover {
    background: var(--status-danger);
    color: white;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  background: var(--status-warning);
  color: white;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  min-width: 20px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.spinning {
  animation: spin 1s linear infinite;
}
</style>

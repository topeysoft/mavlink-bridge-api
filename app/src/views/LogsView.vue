<template>
  <div class="logs-view">
    <div class="page-header">
      <div>
        <h1>Activity Logs</h1>
        <p class="subtitle">View and analyze activity data and telemetry logs</p>
      </div>
      <div class="header-actions">
        <button
          class="btn btn-primary"
          @click="handleDownloadLog"
          :disabled="logsStore.loading"
        >
          <span class="icon">📥</span>
          {{ logsStore.loading ? 'Downloading...' : 'Download from Vehicle' }}
        </button>
      </div>
    </div>

    <div class="logs-container">
      <!-- Sidebar: Log List -->
      <div class="logs-sidebar">
        <div class="sidebar-header">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input
              type="text"
              v-model="searchTerm"
              placeholder="Search logs..."
              class="search-input"
            />
            <button
              v-if="searchTerm"
              @click="searchTerm = ''"
              class="clear-btn"
            >
              ✕
            </button>
          </div>

          <button
            class="btn btn-secondary full-width"
            @click="showFilterDialog = true"
          >
            <span class="icon">⚙️</span>
            Filter
          </button>
        </div>

        <div class="logs-list">
          <div
            v-for="log in logsStore.filteredLogs"
            :key="log.id"
            class="log-item"
            :class="{ active: logsStore.selectedLogId === log.id }"
            @click="logsStore.selectLog(log.id)"
          >
            <div class="log-info">
              <div class="log-name">{{ log.name }}</div>
              <div class="log-date">{{ formatDate(log.startTime) }}</div>
              <div class="log-meta">
                <span>⏱️ {{ formatDuration(log.duration) }}</span>
                <span>📏 {{ log.statistics.distanceTraveled.toFixed(0) }}m</span>
              </div>
            </div>

            <div class="log-actions">
              <button
                class="action-btn"
                @click.stop="toggleMenu(log.id)"
              >
                ⋮
              </button>
              <div v-if="activeMenu === log.id" class="dropdown-menu">
                <button @click.stop="handleExport(log.id)">
                  <span class="icon">💾</span>
                  Export
                </button>
                <button @click.stop="handleDelete(log.id)" class="danger">
                  <span class="icon">🗑️</span>
                  Delete
                </button>
              </div>
            </div>
          </div>

          <div v-if="logsStore.filteredLogs.length === 0" class="empty-state">
            <div class="empty-icon">📊</div>
            <div>No logs found</div>
          </div>
        </div>
      </div>

      <!-- Main Content: Log Details -->
      <div class="logs-content">
        <div v-if="!logsStore.selectedLog" class="no-selection">
          <div class="no-selection-icon">📈</div>
          <p>Select a log to view details</p>
        </div>

        <div v-else class="log-details">
          <LogSummary :log="logsStore.selectedLog" />
          <LogTimeline :log="logsStore.selectedLog" />
          <LogCharts :log="logsStore.selectedLog" />
        </div>
      </div>
    </div>

    <!-- Filter Dialog -->
    <div v-if="showFilterDialog" class="modal-overlay" @click="showFilterDialog = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>Filter Logs</h2>
          <button @click="showFilterDialog = false" class="close-btn">✕</button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label>Start Date</label>
            <input
              type="date"
              v-model="filterForm.startDate"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label>End Date</label>
            <input
              type="date"
              v-model="filterForm.endDate"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label>Min Duration (seconds)</label>
            <input
              type="number"
              v-model.number="filterForm.minDuration"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label>Max Duration (seconds)</label>
            <input
              type="number"
              v-model.number="filterForm.maxDuration"
              class="form-input"
            />
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="handleClearFilter">Clear</button>
          <button class="btn btn-secondary" @click="showFilterDialog = false">Cancel</button>
          <button class="btn btn-primary" @click="handleApplyFilter">Apply</button>
        </div>
      </div>
    </div>

    <!-- Export Dialog -->
    <div v-if="showExportDialog" class="modal-overlay" @click="showExportDialog = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>Export Log</h2>
          <button @click="showExportDialog = false" class="close-btn">✕</button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label>Format</label>
            <select v-model="exportFormat" class="form-input">
              <option value="csv">CSV</option>
              <option value="kml">KML</option>
              <option value="geojson">GeoJSON</option>
              <option value="json">JSON</option>
            </select>
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="exportIncludeMetadata" />
              Include metadata
            </label>
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="exportIncludeStatistics" />
              Include statistics
            </label>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showExportDialog = false">Cancel</button>
          <button class="btn btn-primary" @click="handleConfirmExport">Export</button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation -->
    <div v-if="showDeleteDialog" class="modal-overlay" @click="showDeleteDialog = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>Delete Log</h2>
          <button @click="showDeleteDialog = false" class="close-btn">✕</button>
        </div>

        <div class="modal-body">
          <p>Are you sure you want to delete this log? This cannot be undone.</p>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showDeleteDialog = false">Cancel</button>
          <button class="btn btn-danger" @click="confirmDelete">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useLogsStore } from '@/stores/logs';
import { useDialog } from '@/composables/useDialog';
import LogSummary from '@/components/logs/LogSummary.vue';
import LogTimeline from '@/components/logs/LogTimeline.vue';
import LogCharts from '@/components/logs/LogCharts.vue';
import type { LogExportFormat } from '@/types/log';

const logsStore = useLogsStore();
const dialog = useDialog();

const searchTerm = ref('');
const showFilterDialog = ref(false);
const showExportDialog = ref(false);
const showDeleteDialog = ref(false);
const exportLogId = ref<string | null>(null);
const deleteLogId = ref<string | null>(null);
const activeMenu = ref<string | null>(null);

const filterForm = ref({
  startDate: '',
  endDate: '',
  minDuration: undefined as number | undefined,
  maxDuration: undefined as number | undefined,
});

const exportFormat = ref<'csv' | 'kml' | 'geojson' | 'json'>('csv');
const exportIncludeMetadata = ref(true);
const exportIncludeStatistics = ref(true);

watch(searchTerm, (value) => {
  logsStore.setFilter({ searchTerm: value });
});

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}m ${seconds % 60}s`;
}

async function handleDownloadLog() {
  try {
    await logsStore.downloadLog('');
    await dialog.alert('Log downloaded successfully', 'Success', { variant: 'success' });
  } catch (error) {
    await dialog.alert('Failed to download log', 'Error', { variant: 'error' });
  }
}

function toggleMenu(logId: string) {
  activeMenu.value = activeMenu.value === logId ? null : logId;
}

function handleExport(logId: string) {
  exportLogId.value = logId;
  showExportDialog.value = true;
  activeMenu.value = null;
}

async function handleConfirmExport() {
  if (!exportLogId.value) return;

  try {
    const format: LogExportFormat = {
      type: exportFormat.value,
      includeMetadata: exportIncludeMetadata.value,
      includeStatistics: exportIncludeStatistics.value,
    };

    const data = logsStore.exportLog(exportLogId.value, format);
    const log = logsStore.logs.find(l => l.id === exportLogId.value);

    // Create download
    const blob = new Blob([data], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${log?.name || 'log'}.${exportFormat.value}`;
    a.click();
    URL.revokeObjectURL(url);

    showExportDialog.value = false;
    await dialog.alert('Log exported successfully', 'Success', { variant: 'success' });
  } catch (error) {
    await dialog.alert('Failed to export log', 'Error', { variant: 'error' });
  }
}

function handleDelete(logId: string) {
  deleteLogId.value = logId;
  showDeleteDialog.value = true;
  activeMenu.value = null;
}

function confirmDelete() {
  if (deleteLogId.value) {
    logsStore.deleteLog(deleteLogId.value);
    showDeleteDialog.value = false;
    deleteLogId.value = null;
  }
}

function handleApplyFilter() {
  const filter: any = {};

  if (filterForm.value.startDate) {
    filter.startDate = new Date(filterForm.value.startDate).getTime();
  }

  if (filterForm.value.endDate) {
    filter.endDate = new Date(filterForm.value.endDate).getTime();
  }

  if (filterForm.value.minDuration) {
    filter.minDuration = filterForm.value.minDuration;
  }

  if (filterForm.value.maxDuration) {
    filter.maxDuration = filterForm.value.maxDuration;
  }

  logsStore.setFilter(filter);
  showFilterDialog.value = false;
}

function handleClearFilter() {
  filterForm.value = {
    startDate: '',
    endDate: '',
    minDuration: undefined,
    maxDuration: undefined,
  };
  logsStore.clearFilter();
  showFilterDialog.value = false;
}

// Close menu when clicking outside
function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (!target.closest('.log-actions')) {
    activeMenu.value = null;
  }
}

onMounted(() => {
  logsStore.loadLogs();
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;
@use 'sass:color';

.logs-view {
  padding: 24px;
  height: 100%;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;

  h1 {
    margin: 0 0 8px 0;
    color: $primary;
    font-size: 28px;
  }

  .subtitle {
    margin: 0;
    color: $grey-7;
  }
}

.logs-container {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 24px;
  height: calc(100vh - 180px);
}

.logs-sidebar {
  background: white;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid $grey-3;
}

.sidebar-header {
  margin-bottom: 16px;
}

.search-box {
  position: relative;
  margin-bottom: 12px;

  .search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 10px 40px 10px 36px;
    border: 1px solid $grey-3;
    border-radius: 6px;
    font-size: 14px;

    &:focus {
      outline: none;
      border-color: $primary;
    }
  }

  .clear-btn {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px 8px;
    color: $grey-6;

    &:hover {
      color: $grey-8;
    }
  }
}

.logs-list {
  flex: 1;
  overflow-y: auto;
}

.log-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s;

  &:hover {
    background-color: $grey-1;
    border-color: $grey-3;
  }

  &.active {
    background-color: rgba($primary, 0.1);
    border-color: $primary;
  }
}

.log-info {
  flex: 1;
  min-width: 0;
}

.log-name {
  font-weight: 600;
  color: $dark;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-date {
  font-size: 12px;
  color: $grey-6;
  margin-bottom: 4px;
}

.log-meta {
  font-size: 12px;
  color: $grey-7;
  display: flex;
  gap: 12px;
}

.log-actions {
  position: relative;
  margin-left: 8px;
}

.action-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  font-size: 18px;
  color: $grey-6;
  border-radius: 4px;

  &:hover {
    background: $grey-2;
    color: $grey-8;
  }
}

.dropdown-menu {
  position: absolute;
  right: 0;
  top: 100%;
  background: white;
  border: 1px solid $grey-3;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  min-width: 140px;
  z-index: 10;
  margin-top: 4px;

  button {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px 16px;
    border: none;
    background: none;
    cursor: pointer;
    text-align: left;
    font-size: 14px;
    color: $dark;

    &:hover {
      background: $grey-1;
    }

    &.danger {
      color: $negative;
    }

    .icon {
      font-size: 16px;
    }
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  color: $grey-6;

  .empty-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }
}

.logs-content {
  background: white;
  border-radius: 8px;
  padding: 24px;
  overflow-y: auto;
  border: 1px solid $grey-3;
}

.no-selection {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: $grey-6;

  .no-selection-icon {
    font-size: 64px;
    margin-bottom: 16px;
  }
}

.log-details {
  animation: fadeIn 0.3s ease-in;

  > * + * {
    margin-top: 24px;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// Modal styles
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal {
  background: white;
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid $grey-3;

  h2 {
    margin: 0;
    font-size: 20px;
    color: $dark;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: $grey-6;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;

    &:hover {
      background: $grey-2;
      color: $grey-8;
    }
  }
}

.modal-body {
  padding: 24px;
}

.modal-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 16px 24px;
  border-top: 1px solid $grey-3;
}

.form-group {
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0;
  }

  label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
    color: $grey-8;
    font-size: 14px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;

    input[type="checkbox"] {
      cursor: pointer;
    }
  }
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid $grey-3;
  border-radius: 6px;
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: $primary;
  }
}

// Button styles
.btn {
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .icon {
    font-size: 16px;
  }

  &.full-width {
    width: 100%;
    justify-content: center;
  }
}

.btn-primary {
  background: $primary;
  color: white;

  &:hover:not(:disabled) {
    background: color.adjust($primary, $lightness: -5%);
  }
}

.btn-secondary {
  background: $grey-2;
  color: $dark;

  &:hover {
    background: $grey-3;
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
</style>

<template>
  <q-card class="log-viewer">
    <q-card-section>
      <div class="row items-center q-mb-sm">
        <div class="col">
          <div class="text-h6">System Logs</div>
        </div>
        <div class="col-auto q-gutter-x-sm">
          <q-btn
            flat
            round
            dense
            icon="mdi-filter"
            @click="showFilters = !showFilters"
          >
            <q-badge v-if="activeFiltersCount" color="primary" floating>
              {{ activeFiltersCount }}
            </q-badge>
          </q-btn>
          <q-btn
            flat
            round
            dense
            icon="mdi-download"
            @click="exportLogs"
          />
          <q-btn
            flat
            round
            dense
            icon="mdi-delete"
            @click="clearLogs"
          />
        </div>
      </div>

      <!-- Filters -->
      <q-slide-transition>
        <div v-show="showFilters" class="q-mb-md">
          <div class="row q-col-gutter-sm">
            <div class="col-12 col-sm-6">
              <q-select
                v-model="filters.levels"
                label="Log Levels"
                multiple
                :options="logLevels"
                use-chips
                stack-label
                dense
              />
            </div>
            <div class="col-12 col-sm-6">
              <q-input
                v-model="filters.search"
                label="Search"
                dense
                clearable
              >
                <template v-slot:prepend>
                  <q-icon name="search" />
                </template>
              </q-input>
            </div>
          </div>
        </div>
      </q-slide-transition>

      <!-- Log entries -->
      <q-virtual-scroll
        :items="filteredLogs"
        virtual-scroll-slice-size="30"
        class="log-scroll"
        v-slot="{ item, index }"
      >
        <div
          :key="index"
          class="log-entry"
          :class="`log-${item.level}`"
        >
          <div class="log-timestamp">
            {{ formatTimestamp(item.timestamp) }}
          </div>
          <div class="log-level">
            <q-chip
              :color="getLevelColor(item.level)"
              text-color="white"
              size="sm"
              dense
            >
              {{ item.level }}
            </q-chip>
          </div>
          <div class="log-message">
            {{ item.message }}
            <div v-if="item.details" class="log-details">
              {{ item.details }}
            </div>
          </div>
        </div>
      </q-virtual-scroll>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'

interface LogEntry {
  timestamp: number
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  details?: string
}

interface Props {
  logs: LogEntry[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  clearLogs: []
}>()

const $q = useQuasar()

const showFilters = ref(false)
const filters = ref({
  levels: ['info', 'warn', 'error'] as string[],
  search: ''
})

const logLevels = ['debug', 'info', 'warn', 'error']

const filteredLogs = computed(() => {
  return props.logs.filter(log => {
    if (!filters.value.levels.includes(log.level)) return false
    if (filters.value.search) {
      const search = filters.value.search.toLowerCase()
      return log.message.toLowerCase().includes(search) ||
             (log.details && log.details.toLowerCase().includes(search))
    }
    return true
  })
})

const activeFiltersCount = computed(() => {
  let count = 0
  if (filters.value.levels.length < 4) count++
  if (filters.value.search) count++
  return count
})

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString()
}

function getLevelColor(level: string): string {
  const colors: Record<string, string> = {
    debug: 'grey',
    info: 'info',
    warn: 'warning',
    error: 'negative'
  }
  return colors[level] || 'grey'
}

function exportLogs() {
  const content = filteredLogs.value
    .map(log => `${new Date(log.timestamp).toISOString()} [${log.level}] ${log.message}`)
    .join('\n')
  
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `yardrover-logs-${Date.now()}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

function clearLogs() {
  $q.dialog({
    title: 'Clear Logs',
    message: 'Are you sure you want to clear all logs?',
    cancel: true,
    persistent: true
  }).onOk(() => {
    emit('clearLogs')
  })
}
</script>

<style lang="scss" scoped>
.log-viewer {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.log-scroll {
  height: 400px;
  background: $grey-1;
  border-radius: 4px;
  
  .body--dark & {
    background: $grey-10;
  }
}

.log-entry {
  display: flex;
  align-items: flex-start;
  padding: 8px;
  border-bottom: 1px solid $grey-3;
  font-family: monospace;
  font-size: 12px;
  
  .body--dark & {
    border-color: $grey-8;
  }
  
  &.log-error {
    background: rgba(255, 0, 0, 0.05);
  }
  
  &.log-warn {
    background: rgba(255, 152, 0, 0.05);
  }
}

.log-timestamp {
  flex: 0 0 90px;
  color: $grey-7;
  
  .body--dark & {
    color: $grey-5;
  }
}

.log-level {
  flex: 0 0 80px;
  margin: 0 8px;
}

.log-message {
  flex: 1;
  word-break: break-word;
}

.log-details {
  margin-top: 4px;
  color: $grey-6;
  font-size: 11px;
}
</style>
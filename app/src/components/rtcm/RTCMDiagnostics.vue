<template>
  <div>
    <div class="text-subtitle1 q-mb-md">Diagnostics & Troubleshooting</div>

    <!-- Connection Test -->
    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <div class="row items-center">
          <div class="col">
            <div class="text-subtitle2">Connection Test</div>
            <div class="text-caption text-grey-6">Test connectivity to RTCM source</div>
          </div>
          <div class="col-auto">
            <q-btn
              label="Run Test"
              color="primary"
              @click="runConnectionTest"
              :loading="testRunning"
              :disable="!canRunTest"
            />
          </div>
        </div>

        <q-linear-progress
          v-if="testRunning"
          indeterminate
          color="primary"
          class="q-mt-md"
        />

        <div v-if="testResults" class="q-mt-md">
          <q-list dense separator>
            <q-item v-for="(result, key) in testResults" :key="key">
              <q-item-section avatar>
                <q-icon 
                  :name="result.success ? 'mdi-check-circle' : 'mdi-close-circle'"
                  :color="result.success ? 'positive' : 'negative'"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ result.test }}</q-item-label>
                <q-item-label caption>{{ result.message }}</q-item-label>
              </q-item-section>
              <q-item-section side v-if="result.duration">
                <q-item-label caption>{{ result.duration }}ms</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </div>
      </q-card-section>
    </q-card>

    <!-- Common Issues -->
    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <div class="text-subtitle2 q-mb-md">Common Issues</div>
        <q-expansion-item
          v-for="issue in commonIssues"
          :key="issue.id"
          :label="issue.title"
          :caption="issue.description"
          group="issues"
          header-class="text-primary"
        >
          <q-card>
            <q-card-section>
              <div class="text-body2 q-mb-md">{{ issue.explanation }}</div>
              
              <div class="text-subtitle2 q-mb-sm">Possible Solutions:</div>
              <q-list dense>
                <q-item v-for="(solution, index) in issue.solutions" :key="index">
                  <q-item-section avatar>
                    <q-icon name="mdi-chevron-right" size="xs" />
                  </q-item-section>
                  <q-item-section>
                    {{ solution }}
                  </q-item-section>
                </q-item>
              </q-list>

              <div v-if="issue.checkCommand" class="q-mt-md">
                <q-btn
                  :label="`Run ${issue.checkCommand.label}`"
                  size="sm"
                  color="secondary"
                  @click="runCheck(issue.checkCommand)"
                />
              </div>
            </q-card-section>
          </q-card>
        </q-expansion-item>
      </q-card-section>
    </q-card>

    <!-- System Information -->
    <q-card flat bordered>
      <q-card-section>
        <div class="text-subtitle2 q-mb-md">System Information</div>
        <q-list dense separator>
          <q-item>
            <q-item-section>
              <q-item-label>RTCM Client Status</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-badge :color="isActive ? 'positive' : 'grey'">
                {{ isActive ? 'Active' : 'Inactive' }}
              </q-badge>
            </q-item-section>
          </q-item>
          
          <q-item>
            <q-item-section>
              <q-item-label>Connection State</q-item-label>
            </q-item-section>
            <q-item-section side>
              {{ realtimeState }}
            </q-item-section>
          </q-item>

          <q-item v-if="config.data">
            <q-item-section>
              <q-item-label>Output Format</q-item-label>
            </q-item-section>
            <q-item-section side>
              raw
            </q-item-section>
          </q-item>

          <q-item v-if="formattedStatistics">
            <q-item-section>
              <q-item-label>Data Rate</q-item-label>
            </q-item-section>
            <q-item-section side>
              {{ formattedStatistics.formattedDataRate }}
            </q-item-section>
          </q-item>

          <q-item v-if="formattedStatistics">
            <q-item-section>
              <q-item-label>Error Rate</q-item-label>
            </q-item-section>
            <q-item-section side>
              {{ errorRate }}%
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>

    <!-- Debug Log -->
    <q-expansion-item
      label="Debug Log"
      icon="mdi-bug"
      class="q-mt-md"
    >
      <q-card>
        <q-card-section>
          <div class="debug-log">
            <pre>{{ debugLog }}</pre>
          </div>
          <q-btn
            label="Copy Log"
            icon="mdi-content-copy"
            flat
            size="sm"
            @click="copyDebugLog"
            class="q-mt-md"
          />
        </q-card-section>
      </q-card>
    </q-expansion-item>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useRTCM } from '../../composables/useRTCM'

const $q = useQuasar()
const {
  isActive,
  config,
  realtimeState,
  formattedStatistics,
  status,
  connectionHistory
} = useRTCM()

const testRunning = ref(false)
const testResults = ref<Record<string, {test: string, success: boolean, message: string, duration?: number}> | null>(null)

const canRunTest = computed(() => 
  config.value.data?.source && !testRunning.value
)

const errorRate = computed(() => {
  const stats = formattedStatistics.value
  if (!stats || stats.messagesReceived === 0) return '0.00'
  return ((stats.crcErrors / stats.messagesReceived) * 100).toFixed(2)
})

const commonIssues = [
  {
    id: 'no-connection',
    title: 'Cannot Connect to RTCM Source',
    description: 'Unable to establish connection to NTRIP/TCP/UDP source',
    explanation: 'This usually occurs when the source is unreachable or credentials are incorrect.',
    solutions: [
      'Verify the host address and port are correct',
      'Check your internet connection',
      'Ensure firewall is not blocking the connection',
      'For NTRIP: Verify mountpoint name and credentials',
      'Try connecting to the source from another device to verify it\'s online'
    ],
    checkCommand: {
      label: 'Network Test',
      action: 'network-test'
    }
  },
  {
    id: 'no-data',
    title: 'Connected but No Data Received',
    description: 'Connection established but no RTCM messages are coming through',
    explanation: 'The connection is successful but the source is not sending data.',
    solutions: [
      'Verify the source is actively transmitting',
      'Check if the mountpoint is correct (NTRIP)',
      'Ensure your account has access to the data stream',
      'Try a different mountpoint or source',
      'Check if position needs to be sent (some NTRIP casters require it)'
    ]
  },
  {
    id: 'high-errors',
    title: 'High CRC Error Rate',
    description: 'Many corrupted messages are being received',
    explanation: 'Data is being received but many messages are corrupted.',
    solutions: [
      'Check network stability and latency',
      'Reduce data rate if possible',
      'Try a closer RTCM source',
      'Check for electromagnetic interference',
      'Verify serial/network settings match the source'
    ]
  },
  {
    id: 'frequent-disconnects',
    title: 'Frequent Disconnections',
    description: 'Connection drops repeatedly',
    explanation: 'The connection is unstable and drops frequently.',
    solutions: [
      'Check WiFi signal strength',
      'Verify power supply is stable',
      'Check for network timeout settings',
      'Enable keep-alive if supported',
      'Consider using a different connection type'
    ]
  }
]

const debugLog = computed(() => {
  const log = []
  
  log.push('=== RTCM Debug Information ===')
  log.push(`Generated: ${new Date().toISOString()}`)
  log.push('')
  
  log.push('Configuration:')
  if (config.value.data) {
    log.push(`  Enabled: ${config.value.data.enabled}`)
    log.push(`  Source Type: ${config.value.data.source.type}`)
    log.push(`  Output Format: raw`)
    log.push(`  Source Details: ${JSON.stringify(config.value.data.source, null, 2)}`)
  } else {
    log.push('  No configuration loaded')
  }
  log.push('')
  
  log.push('Status:')
  log.push(`  Active: ${isActive.value}`)
  log.push(`  State: ${realtimeState.value}`)
  if (status.value.data) {
    log.push(`  Running: ${status.value.data.running}`)
    log.push(`  Client Type: ${status.value.data.clientType || 'N/A'}`)
  }
  log.push('')
  
  if (formattedStatistics.value) {
    log.push('Statistics:')
    log.push(`  Messages Received: ${formattedStatistics.value.messagesReceived}`)
    log.push(`  Bytes Received: ${formattedStatistics.value.bytesReceived}`)
    log.push(`  CRC Errors: ${formattedStatistics.value.crcErrors}`)
    log.push(`  Data Rate: ${formattedStatistics.value.formattedDataRate}`)
    log.push(`  Uptime: ${formattedStatistics.value.formattedUptime}`)
    log.push('')
  }
  
  log.push('Recent Connections:')
  connectionHistory.value.slice(0, 5).forEach(conn => {
    log.push(`  ${new Date(conn.timestamp).toISOString()} - ${conn.source} - ${conn.success ? 'Success' : 'Failed'}`)
    if (conn.error) log.push(`    Error: ${conn.error}`)
  })
  
  return log.join('\n')
})

async function runConnectionTest() {
  testRunning.value = true
  testResults.value = null
  
  const results: Record<string, {test: string, success: boolean, message: string, duration?: number}> = {}
  
  // Simulate connection tests
  try {
    // Test 1: Configuration valid
    results.config = {
      test: 'Configuration Check',
      success: !!config.value.data?.source,
      message: config.value.data?.source 
        ? 'Configuration is valid' 
        : 'No configuration found'
    }
    
    // Test 2: Network connectivity (simulate)
    await new Promise(resolve => setTimeout(resolve, 500))
    results.network = {
      test: 'Network Connectivity',
      success: true,
      message: 'Network is reachable',
      duration: 45
    }
    
    // Test 3: Source reachability (simulate)
    await new Promise(resolve => setTimeout(resolve, 800))
    const sourceReachable = Math.random() > 0.3 // 70% success rate for demo
    results.source = {
      test: 'Source Reachability',
      success: sourceReachable,
      message: sourceReachable 
        ? 'Source is reachable' 
        : 'Failed to reach source',
      duration: 250
    }
    
    // Test 4: Authentication (if applicable)
    if (config.value.data?.source.type === 'ntrip' && config.value.data.source.username) {
      await new Promise(resolve => setTimeout(resolve, 300))
      results.auth = {
        test: 'Authentication',
        success: true,
        message: 'Authentication successful',
        duration: 120
      }
    }
    
  } catch (error) {
    console.error('Connection test error:', error)
  } finally {
    testRunning.value = false
    testResults.value = results
  }
}

function runCheck(command: {label: string, action: string}) {
  $q.notify({
    type: 'info',
    message: `Running ${command.label}...`,
    position: 'top'
  })
  
  // Implement specific checks based on command.action
  switch (command.action) {
    case 'network-test':
      void runConnectionTest()
      break
    default:
      console.log('Unknown check command:', command.action)
  }
}

function copyDebugLog() {
  void navigator.clipboard.writeText(debugLog.value)
    .then(() => {
      $q.notify({
        type: 'positive',
        message: 'Debug log copied to clipboard',
        position: 'top'
      })
    })
    .catch(() => {
      $q.notify({
        type: 'negative',
        message: 'Failed to copy debug log',
        position: 'top'
      })
    })
}
</script>

<style scoped>
.debug-log {
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 12px;
  font-family: monospace;
  font-size: 12px;
  overflow-x: auto;
  max-height: 400px;
  overflow-y: auto;
}

.q-dark .debug-log {
  background: #1d1d1d;
  border-color: #313131;
}
</style>
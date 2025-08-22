<template>
  <BasePage title="RTCM" subtitle="Real-Time Kinematic Corrections">
    <div class="row q-col-gutter-md">
      <!-- Connection Status Card -->
      <div class="col-12 col-md-4">
        <RTCMStatusCard />
      </div>

      <!-- Quick Connect Card -->
      <div class="col-12 col-md-8">
        <q-card class="full-height">
          <q-card-section>
            <div class="text-h6">
              <q-icon name="mdi-connection" class="q-mr-sm" />
              Quick Connect
            </div>
          </q-card-section>
          <q-separator />
          <q-card-section>
            <RTCMConnectionForm />
          </q-card-section>
        </q-card>
      </div>

      <!-- Statistics Dashboard -->
      <div class="col-12">
        <RTCMStatistics />
      </div>

      <!-- Tabs for Additional Features -->
      <div class="col-12">
        <q-card>
          <q-tabs
            v-model="activeTab"
            class="text-grey"
            active-color="primary"
            indicator-color="primary"
            align="left"
            narrow-indicator
          >
            <q-tab name="stream" label="Data Stream" icon="mdi-data-matrix" />
            <q-tab name="profiles" label="Connection Profiles" icon="mdi-content-save" />
            <q-tab name="history" label="History" icon="mdi-history" />
            <q-tab name="diagnostics" label="Diagnostics" icon="mdi-medical-bag" />
          </q-tabs>

          <q-separator />

          <q-tab-panels v-model="activeTab" animated>
            <q-tab-panel name="stream">
              <RTCMDataStream />
            </q-tab-panel>

            <q-tab-panel name="profiles">
              <RTCMProfiles />
            </q-tab-panel>

            <q-tab-panel name="history">
              <RTCMHistory />
            </q-tab-panel>

            <q-tab-panel name="diagnostics">
              <RTCMDiagnostics />
            </q-tab-panel>
          </q-tab-panels>
        </q-card>
      </div>
    </div>
  </BasePage>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRTCM } from '../composables/useRTCM'
import BasePage from '../components/layout/BasePage.vue'
import RTCMStatusCard from '../components/rtcm/RTCMStatusCard.vue'
import RTCMConnectionForm from '../components/rtcm/RTCMConnectionForm.vue'
import RTCMStatistics from '../components/rtcm/RTCMStatistics.vue'
import RTCMDataStream from '../components/rtcm/RTCMDataStream.vue'
import RTCMProfiles from '../components/rtcm/RTCMProfiles.vue'
import RTCMHistory from '../components/rtcm/RTCMHistory.vue'
import RTCMDiagnostics from '../components/rtcm/RTCMDiagnostics.vue'

const { fetchStatus, isActive } = useRTCM()

const activeTab = ref('stream')

// Refresh status periodically when active
let statusInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  // Initial fetch
  fetchStatus().catch(err => {
    console.error('Failed to fetch RTCM status:', err)
  })

  // Set up periodic refresh when RTCM is active
  statusInterval = setInterval(() => {
    if (isActive.value) {
      fetchStatus().catch(err => {
        console.error('Failed to fetch RTCM status:', err)
      })
    }
  }, 5000)
})

onUnmounted(() => {
  if (statusInterval) {
    clearInterval(statusInterval)
  }
})
</script>
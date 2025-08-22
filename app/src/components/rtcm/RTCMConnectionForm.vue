<template>
  <q-form @submit="handleConnect" ref="formRef">
    <div class="row q-col-gutter-md">
      <!-- Connection Type -->
      <div class="col-12">
        <q-select
          v-model="connectionType"
          :options="connectionTypeOptions"
          label="Connection Type"
          emit-value
          map-options
          :disable="isActive"
        >
          <template v-slot:prepend>
            <q-icon name="mdi-connection" />
          </template>
        </q-select>
      </div>

      <!-- NTRIP Configuration -->
      <template v-if="connectionType === 'ntrip'">
        <div class="col-12 col-md-8">
          <q-input
            v-model="ntripConfig.host"
            label="Host"
            hint="NTRIP caster hostname or IP"
            :rules="[val => !!val || 'Host is required']"
            :disable="isActive"
          >
            <template v-slot:prepend>
              <q-icon name="mdi-server" />
            </template>
          </q-input>
        </div>

        <div class="col-12 col-md-4">
          <q-input
            v-model.number="ntripConfig.port"
            label="Port"
            type="number"
            hint="Default: 2101"
            :rules="[
              val => val >= 1 || 'Port must be at least 1',
              val => val <= 65535 || 'Port must be 65535 or less'
            ]"
            :disable="isActive"
          >
            <template v-slot:prepend>
              <q-icon name="mdi-ethernet-cable" />
            </template>
          </q-input>
        </div>

        <div class="col-12">
          <q-input
            v-model="ntripConfig.mountpoint"
            label="Mountpoint"
            hint="NTRIP mountpoint name"
            :rules="[val => !!val || 'Mountpoint is required']"
            :disable="isActive"
          >
            <template v-slot:prepend>
              <q-icon name="mdi-map-marker" />
            </template>
          </q-input>
        </div>

        <div class="col-12 col-md-6">
          <q-input
            v-model="ntripConfig.username"
            label="Username (optional)"
            :disable="isActive"
          >
            <template v-slot:prepend>
              <q-icon name="mdi-account" />
            </template>
          </q-input>
        </div>

        <div class="col-12 col-md-6">
          <q-input
            v-model="ntripConfig.password"
            label="Password (optional)"
            :type="showPassword ? 'text' : 'password'"
            :disable="isActive"
          >
            <template v-slot:prepend>
              <q-icon name="mdi-lock" />
            </template>
            <template v-slot:append>
              <q-icon
                :name="showPassword ? 'visibility_off' : 'visibility'"
                class="cursor-pointer"
                @click="showPassword = !showPassword"
              />
            </template>
          </q-input>
        </div>

        <div class="col-12">
          <q-toggle
            v-model="ntripConfig.sendPosition"
            label="Send device position to NTRIP caster"
            :disable="isActive"
          />
        </div>

        <div v-if="ntripConfig.sendPosition" class="col-12">
          <div class="row q-col-gutter-sm">
            <div class="col-4">
              <q-input
                v-model.number="ntripConfig.position.latitude"
                label="Latitude"
                type="number"
                step="0.0000001"
                :disable="isActive"
              />
            </div>
            <div class="col-4">
              <q-input
                v-model.number="ntripConfig.position.longitude"
                label="Longitude"
                type="number"
                step="0.0000001"
                :disable="isActive"
              />
            </div>
            <div class="col-4">
              <q-input
                v-model.number="ntripConfig.position.altitude"
                label="Altitude (m)"
                type="number"
                :disable="isActive"
              />
            </div>
          </div>
        </div>
      </template>

      <!-- TCP Configuration -->
      <template v-if="connectionType === 'tcp'">
        <div class="col-12 col-md-8">
          <q-input
            v-model="tcpConfig.host"
            label="Host"
            hint="TCP server hostname or IP"
            :rules="[val => !!val || 'Host is required']"
            :disable="isActive"
          >
            <template v-slot:prepend>
              <q-icon name="mdi-server" />
            </template>
          </q-input>
        </div>

        <div class="col-12 col-md-4">
          <q-input
            v-model.number="tcpConfig.port"
            label="Port"
            type="number"
            :rules="[
              val => val >= 1 || 'Port must be at least 1',
              val => val <= 65535 || 'Port must be 65535 or less'
            ]"
            :disable="isActive"
          >
            <template v-slot:prepend>
              <q-icon name="mdi-ethernet-cable" />
            </template>
          </q-input>
        </div>
      </template>

      <!-- UDP Configuration -->
      <template v-if="connectionType === 'udp'">
        <div class="col-12 col-md-4">
          <q-input
            v-model.number="udpConfig.port"
            label="Local Port"
            type="number"
            hint="Port to listen on"
            :rules="[
              val => val >= 1 || 'Port must be at least 1',
              val => val <= 65535 || 'Port must be 65535 or less'
            ]"
            :disable="isActive"
          >
            <template v-slot:prepend>
              <q-icon name="mdi-ethernet-cable" />
            </template>
          </q-input>
        </div>

        <div class="col-12 col-md-4">
          <q-input
            v-model="udpConfig.remoteHost"
            label="Remote Host (optional)"
            hint="For sending data back"
            :disable="isActive"
          >
            <template v-slot:prepend>
              <q-icon name="mdi-server" />
            </template>
          </q-input>
        </div>

        <div class="col-12 col-md-4">
          <q-input
            v-model.number="udpConfig.remotePort"
            label="Remote Port (optional)"
            type="number"
            :disable="isActive || !udpConfig.remoteHost"
          >
            <template v-slot:prepend>
              <q-icon name="mdi-ethernet-cable" />
            </template>
          </q-input>
        </div>
      </template>

      <!-- Output Format -->
      <div class="col-12">
        <q-select
          v-model="outputFormat"
          :options="outputFormatOptions"
          label="Output Format"
          emit-value
          map-options
          :disable="isActive"
        >
          <template v-slot:prepend>
            <q-icon name="mdi-format-list-bulleted" />
          </template>
        </q-select>
      </div>

      <!-- Connect Button -->
      <div class="col-12">
        <q-btn
          type="submit"
          :label="isActive ? 'Disconnect' : 'Connect'"
          :color="isActive ? 'negative' : 'primary'"
          :loading="isStarting || isStopping"
          :disable="!canStart && !canStop"
          class="full-width"
        />
      </div>

      <!-- Save as Profile -->
      <div class="col-12" v-if="!isActive">
        <q-btn
          label="Save as Profile"
          color="secondary"
          flat
          icon="mdi-content-save"
          @click="showSaveProfileDialog = true"
          class="full-width"
        />
      </div>
    </div>
  </q-form>

  <!-- Save Profile Dialog -->
  <q-dialog v-model="showSaveProfileDialog">
    <q-card style="min-width: 350px">
      <q-card-section>
        <div class="text-h6">Save Connection Profile</div>
      </q-card-section>

      <q-card-section>
        <q-input
          v-model="profileName"
          label="Profile Name"
          autofocus
          @keyup.enter="saveProfile"
        />
        <q-input
          v-model="profileDescription"
          label="Description (optional)"
          type="textarea"
          rows="2"
          class="q-mt-md"
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="primary" v-close-popup />
        <q-btn 
          flat 
          label="Save" 
          color="primary" 
          @click="saveProfile"
          :disable="!profileName"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { useRTCM } from '../../composables/useRTCM'
import type { RTCMConfig } from '@mavlinkbridge/api-client'

const $q = useQuasar()
const {
  isActive,
  isStarting,
  isStopping,
  canStart,
  canStop,
  startRTCM,
  stopRTCM,
  saveProfile: saveRTCMProfile
} = useRTCM()

const formRef = ref()
const showPassword = ref(false)
const showSaveProfileDialog = ref(false)
const profileName = ref('')
const profileDescription = ref('')

const connectionType = ref<'ntrip' | 'tcp' | 'udp'>('ntrip')
const outputFormat = ref<'raw' | 'mavlink'>('raw')

const ntripConfig = ref({
  host: '',
  port: 2101,
  mountpoint: '',
  username: '',
  password: '',
  sendPosition: false,
  position: {
    latitude: 0,
    longitude: 0,
    altitude: 0
  }
})

const tcpConfig = ref({
  host: '',
  port: 2101
})

const udpConfig = ref({
  port: 2101,
  remoteHost: '',
  remotePort: 2101
})

const connectionTypeOptions = [
  { label: 'NTRIP', value: 'ntrip', icon: 'mdi-earth' },
  { label: 'TCP', value: 'tcp', icon: 'mdi-ethernet' },
  { label: 'UDP', value: 'udp', icon: 'mdi-access-point' }
]

const outputFormatOptions = [
  { label: 'Raw RTCM', value: 'raw' },
  { label: 'MAVLink GPS_RTCM_DATA', value: 'mavlink' }
]

async function handleConnect() {
  if (isActive.value) {
    // Disconnect
    try {
      await stopRTCM()
      $q.notify({
        type: 'positive',
        message: 'RTCM disconnected successfully',
        position: 'top'
      })
    } catch (error) {
      $q.notify({
        type: 'negative',
        message: 'Failed to disconnect RTCM',
        caption: error instanceof Error ? error.message : String(error),
        position: 'top'
      })
    }
    return
  }

  // Validate form
  const isValid = await formRef.value.validate()
  if (!isValid) return

  // Build configuration
  const config = {
    enabled: true,
    outputFormat: outputFormat.value
  } as Partial<RTCMConfig>

  // Set source based on type
  switch (connectionType.value) {
    case 'ntrip':
      config.source = {
        type: 'ntrip' as const,
        host: ntripConfig.value.host,
        port: ntripConfig.value.port,
        mountpoint: ntripConfig.value.mountpoint,
        ...(ntripConfig.value.username && { username: ntripConfig.value.username }),
        ...(ntripConfig.value.password && { password: ntripConfig.value.password }),
        ...(ntripConfig.value.sendPosition && {
          sendPosition: true,
          position: {
            latitude: ntripConfig.value.position.latitude,
            longitude: ntripConfig.value.position.longitude,
            altitude: ntripConfig.value.position.altitude
          }
        })
      }
      break

    case 'tcp':
      config.source = {
        type: 'tcp' as const,
        host: tcpConfig.value.host,
        port: tcpConfig.value.port
      }
      break

    case 'udp':
      config.source = {
        type: 'udp' as const,
        host: 'localhost',
        port: udpConfig.value.port,
        ...(udpConfig.value.remoteHost && { remoteHost: udpConfig.value.remoteHost }),
        ...(udpConfig.value.remotePort && udpConfig.value.remoteHost && { 
          remotePort: udpConfig.value.remotePort 
        })
      }
      break
  }

  try {
    await startRTCM(config as RTCMConfig)
    $q.notify({
      type: 'positive',
      message: 'RTCM connected successfully',
      position: 'top'
    })
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to connect RTCM',
      caption: error instanceof Error ? error.message : String(error),
      position: 'top'
    })
  }
}

function saveProfile() {
  const config = buildCurrentConfig()
  
  saveRTCMProfile(
    profileName.value,
    profileDescription.value,
    config
  )

  $q.notify({
    type: 'positive',
    message: 'Profile saved successfully',
    position: 'top'
  })

  showSaveProfileDialog.value = false
  profileName.value = ''
  profileDescription.value = ''
}

function buildCurrentConfig(): RTCMConfig {
  const config = {
    enabled: true,
    outputFormat: outputFormat.value
  } as Partial<RTCMConfig>

  switch (connectionType.value) {
    case 'ntrip':
      config.source = {
        type: 'ntrip' as const,
        host: ntripConfig.value.host,
        port: ntripConfig.value.port,
        mountpoint: ntripConfig.value.mountpoint,
        ...(ntripConfig.value.username && { username: ntripConfig.value.username }),
        ...(ntripConfig.value.password && { password: ntripConfig.value.password })
      }
      break

    case 'tcp':
      config.source = {
        type: 'tcp' as const,
        host: tcpConfig.value.host,
        port: tcpConfig.value.port
      }
      break

    case 'udp':
      config.source = {
        type: 'udp' as const,
        host: 'localhost',
        port: udpConfig.value.port,
        ...(udpConfig.value.remoteHost && { remoteHost: udpConfig.value.remoteHost }),
        ...(udpConfig.value.remotePort && { remotePort: udpConfig.value.remotePort })
      }
      break
  }

  return config as RTCMConfig
}
</script>
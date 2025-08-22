<template>
  <BasePage
    title="MAVLink Parameters"
    subtitle="View and modify flight controller parameters"
    :loading="loading"
    :error="error"
    @retry="loadParameters"
  >
    <template #actions>
      <q-btn
        round
        flat
        icon="mdi-play"
        @click="toggleParameterStream"
        :color="streamActive ? 'positive' : 'grey'"
        :loading="streamLoading"
      >
        <q-tooltip>{{ streamActive ? 'Stop' : 'Start' }} parameter stream</q-tooltip>
      </q-btn>
      <q-btn
        round
        flat
        icon="refresh"
        @click="loadParameters"
        :loading="loading"
      >
        <q-tooltip>Refresh parameters</q-tooltip>
      </q-btn>
    </template>

    <!-- Stream Status -->
    <q-banner
      v-if="streamActive"
      class="bg-positive text-white q-mb-lg"
      rounded
    >
      <template v-slot:avatar>
        <q-icon name="mdi-stream" />
      </template>
      Parameter streaming is active - changes will update automatically
    </q-banner>

    <!-- Modified Parameters Warning -->
    <q-banner
      v-if="modifiedCount > 0"
      class="bg-warning text-white q-mb-lg"
      rounded
    >
      <template v-slot:avatar>
        <q-icon name="warning" />
      </template>
      {{ modifiedCount }} parameter(s) have been modified from default values
      <template v-slot:action>
        <q-btn
          flat
          label="Write to Vehicle"
          @click="writeParameters"
        />
      </template>
    </q-banner>

    <div class="row q-col-gutter-md">
      <!-- Parameter Browser -->
      <div class="col-12 col-lg-8">
        <ParameterBrowser />
      </div>

      <!-- Side Panel -->
      <div class="col-12 col-lg-4">
        <q-tabs
          v-model="sideTab"
          vertical
          active-color="primary"
          indicator-color="primary"
          class="q-mb-md"
        >
          <q-tab name="backup" label="Backup & Restore" />
          <q-tab name="compare" label="Compare" />
          <q-tab name="help" label="Help" />
        </q-tabs>

        <q-tab-panels v-model="sideTab" animated vertical>
          <q-tab-panel name="backup">
            <ParameterBackup />
          </q-tab-panel>

          <q-tab-panel name="compare">
            <ParameterCompare />
          </q-tab-panel>

          <q-tab-panel name="help">
            <q-card>
              <q-card-section>
                <div class="text-h6 q-mb-md">Parameter Help</div>
                
                <q-list>
                  <q-item>
                    <q-item-section avatar>
                      <q-icon name="mdi-help-circle" color="primary" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>Search Tips</q-item-label>
                      <q-item-label caption>
                        Use prefixes like "RC_" or "SERVO_" to find related parameters
                      </q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-item>
                    <q-item-section avatar>
                      <q-icon name="mdi-shield-alert" color="warning" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>Safety Warning</q-item-label>
                      <q-item-label caption>
                        Incorrect parameters can make your vehicle unsafe. Always backup before making changes.
                      </q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-item>
                    <q-item-section avatar>
                      <q-icon name="mdi-information" color="info" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>Parameter Types</q-item-label>
                      <q-item-label caption>
                        Float parameters support decimal values, integer parameters only whole numbers
                      </q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-item>
                    <q-item-section avatar>
                      <q-icon name="mdi-flash" color="orange" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>Real-time Updates</q-item-label>
                      <q-item-label caption>
                        Enable parameter streaming to see changes from other ground stations in real-time
                      </q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-card-section>
            </q-card>
          </q-tab-panel>
        </q-tab-panels>
      </div>
    </div>
  </BasePage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useQuasar } from 'quasar'
import { useMAVLinkParametersStore } from '../stores/mavlink-parameters'
import BasePage from '../components/layout/BasePage.vue'
import ParameterBrowser from '../components/parameters/ParameterBrowser.vue'
import ParameterBackup from '../components/parameters/ParameterBackup.vue'
import ParameterCompare from '../components/parameters/ParameterCompare.vue'

const $q = useQuasar()
const parametersStore = useMAVLinkParametersStore()

const sideTab = ref('backup')
const streamLoading = ref(false)

const loading = computed(() => parametersStore.parameters.loading)
const error = computed(() => parametersStore.parameters.error)
const streamActive = computed(() => parametersStore.streamActive)
const modifiedCount = computed(() => 
  parametersStore.parameterList.filter(p => p.modified).length
)

async function loadParameters() {
  try {
    await parametersStore.fetchParameters()
  } catch (error) {
    console.error('Failed to load parameters:', error)
  }
}

async function toggleParameterStream() {
  streamLoading.value = true
  
  try {
    if (streamActive.value) {
      parametersStore.stopParameterStream()
    } else {
      await parametersStore.startParameterStream()
    }
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to toggle parameter stream',
      caption: error instanceof Error ? error.message : String(error),
      position: 'top'
    })
  } finally {
    streamLoading.value = false
  }
}

function writeParameters() {
  $q.dialog({
    title: 'Write Parameters',
    message: 'Write all modified parameters to the vehicle?',
    cancel: true,
    persistent: true
  }).onOk(() => {
    void (async () => {
      try {
        await parametersStore.writeAllParameters()
        
        $q.notify({
          type: 'positive',
          message: 'Parameters written to vehicle',
          position: 'top'
        })
      } catch (error) {
        $q.notify({
          type: 'negative',
          message: 'Failed to write parameters',
          caption: error instanceof Error ? error.message : String(error),
          position: 'top'
        })
      }
    })()
  })
}

onMounted(() => {
  void loadParameters()
})

onUnmounted(() => {
  // Stop parameter streaming when leaving page
  if (streamActive.value) {
    try {
      parametersStore.stopParameterStream()
    } catch (error) {
      console.error('Failed to stop parameter stream:', error)
    }
  }
})
</script>
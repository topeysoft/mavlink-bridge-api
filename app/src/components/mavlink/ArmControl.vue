<template>
  <q-card>
    <q-card-section>
      <div class="text-h6 q-mb-md">Arm/Disarm Control</div>

      <!-- Pre-flight Checks -->
      <q-expansion-item
        v-model="showChecks"
        icon="mdi-clipboard-check"
        label="Pre-flight Checks"
        :caption="`${passedChecks}/${totalChecks} checks passed`"
        class="q-mb-md"
      >
        <q-list separator>
          <q-item
            v-for="check in preflightChecks"
            :key="check.id"
            dense
          >
            <q-item-section avatar>
              <q-icon
                :name="check.passed ? 'mdi-check-circle' : 'mdi-close-circle'"
                :color="check.passed ? 'positive' : 'negative'"
              />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ check.name }}</q-item-label>
              <q-item-label caption v-if="!check.passed">
                {{ check.message }}
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-expansion-item>

      <!-- Arm/Disarm Button -->
      <div class="text-center">
        <q-btn
          v-if="!isArmed"
          :label="canArm ? 'ARM' : 'Cannot Arm'"
          color="negative"
          size="lg"
          :disable="!canArm"
          @click="confirmArm"
          class="arm-button"
        >
          <q-icon left name="mdi-shield-check" />
          <q-tooltip v-if="!canArm">
            Complete all pre-flight checks first
          </q-tooltip>
        </q-btn>

        <q-btn
          v-else
          label="DISARM"
          color="positive"
          size="lg"
          @click="confirmDisarm"
          class="arm-button"
        >
          <q-icon left name="mdi-shield-off" />
        </q-btn>
      </div>

      <!-- Force Arm Option -->
      <div class="text-center q-mt-md" v-if="!isArmed && !canArm">
        <q-btn
          flat
          label="Force Arm"
          color="negative"
          size="sm"
          @click="confirmForceArm"
        />
        <div class="text-caption text-negative q-mt-xs">
          Use only if you understand the risks
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useMAVLinkStore } from '../../stores/mavlink'

const $q = useQuasar()
const mavlinkStore = useMAVLinkStore()

const showChecks = ref(true)

const isArmed = computed(() => mavlinkStore.vehicleState.armed)
const preflightChecks = computed(() => mavlinkStore.preflightChecks)
const totalChecks = computed(() => preflightChecks.value.length)
const passedChecks = computed(() => 
  preflightChecks.value.filter((c) => c.passed).length
)
const canArm = computed(() => 
  passedChecks.value === totalChecks.value && totalChecks.value > 0
)

function confirmArm() {
  $q.dialog({
    title: 'Arm Vehicle',
    message: 'Are you sure you want to arm the vehicle? The motors will become active.',
    cancel: true,
    persistent: true,
    color: 'negative',
    ok: {
      label: 'ARM',
      color: 'negative'
    }
  }).onOk(() => {
    void (async () => {
      try {
        await mavlinkStore.armVehicle()
        
        $q.notify({
          type: 'warning',
          message: 'Vehicle is ARMED',
          caption: 'Motors are active - keep clear!',
          position: 'top',
          timeout: 0,
          actions: [
            { label: 'Dismiss', color: 'white' }
          ]
        })
      } catch (error: unknown) {
        $q.notify({
          type: 'negative',
          message: 'Failed to arm vehicle',
          caption: error instanceof Error ? error.message : 'Unknown error',
          position: 'top'
        })
      }
    })()
  })
}

function confirmDisarm() {
  $q.dialog({
    title: 'Disarm Vehicle',
    message: 'Are you sure you want to disarm the vehicle?',
    cancel: true,
    persistent: true
  }).onOk(() => {
    void (async () => {
      try {
        await mavlinkStore.disarmVehicle()
        
        $q.notify({
          type: 'positive',
          message: 'Vehicle disarmed',
          position: 'top'
        })
      } catch (error: unknown) {
        $q.notify({
          type: 'negative',
          message: 'Failed to disarm vehicle',
          caption: error instanceof Error ? error.message : 'Unknown error',
          position: 'top'
        })
      }
    })()
  })
}

function confirmForceArm() {
  $q.dialog({
    title: 'Force Arm Vehicle',
    html: true,
    message: `
      <div class="text-negative">
        <strong>WARNING:</strong> Force arming bypasses safety checks!
      </div>
      <div class="q-mt-md">
        This should only be used if you are certain the vehicle is safe to arm
        and understand why the checks are failing.
      </div>
    `,
    cancel: true,
    persistent: true,
    color: 'negative',
    ok: {
      label: 'FORCE ARM',
      color: 'negative'
    }
  }).onOk(() => {
    void (async () => {
      try {
        await mavlinkStore.armVehicle(true)
        
        $q.notify({
          type: 'warning',
          message: 'Vehicle is ARMED (forced)',
          caption: 'Safety checks were bypassed!',
          position: 'top',
          timeout: 0,
          actions: [
            { label: 'Dismiss', color: 'white' }
          ]
        })
      } catch (error: unknown) {
        $q.notify({
          type: 'negative',
          message: 'Failed to force arm vehicle',
          caption: error instanceof Error ? error.message : 'Unknown error',
          position: 'top'
        })
      }
    })()
  })
}
</script>

<style lang="scss" scoped>
.arm-button {
  min-width: 200px;
  height: 60px;
  font-size: 20px;
  font-weight: bold;
}
</style>
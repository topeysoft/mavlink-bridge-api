<template>
  <BasePage
    title="Mission Planning"
    subtitle="Plan and execute autonomous missions"
    no-padding
  >
    <template #actions>
      <q-btn-group>
        <q-btn
          :color="mode === 'plan' ? 'primary' : 'grey'"
          label="Plan"
          @click="mode = 'plan'"
        />
        <q-btn
          :color="mode === 'execute' ? 'primary' : 'grey'"
          label="Execute"
          @click="mode = 'execute'"
        />
      </q-btn-group>
    </template>

    <q-splitter
      v-model="splitterModel"
      :limits="[60, 90]"
      class="mission-splitter"
    >
      <template v-slot:before>
        <div class="mission-main">
          <MissionPlanner v-if="mode === 'plan'" />
          <div v-else class="row q-col-gutter-md q-pa-md">
            <div class="col-12 col-md-8">
              <MissionMapView />
            </div>
            <div class="col-12 col-md-4">
              <MissionExecutor />
            </div>
          </div>
        </div>
      </template>

      <template v-slot:after>
        <div class="mission-sidebar q-pa-md">
          <MissionLibrary v-if="mode === 'plan'" />
          <MissionMonitor v-else />
        </div>
      </template>
    </q-splitter>
  </BasePage>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import BasePage from '@/components/layout/BasePage.vue'
import MissionPlanner from '@/components/mission/MissionPlanner.vue'
import MissionExecutor from '@/components/mission/MissionExecutor.vue'
import MissionMapView from '@/components/mission/MissionMapView.vue'
import MissionLibrary from '@/components/mission/MissionLibrary.vue'
import MissionMonitor from '@/components/mission/MissionMonitor.vue'

const mode = ref<'plan' | 'execute'>('plan')
const splitterModel = ref(75)
</script>

<style lang="scss" scoped>
.mission-splitter {
  height: calc(100vh - 120px);
}

.mission-main {
  height: 100%;
}

.mission-sidebar {
  background: var(--q-color-grey-1);
  height: 100%;
  overflow-y: auto;
  
  .body--dark & {
    background: var(--q-color-grey-9);
  }
}
</style>
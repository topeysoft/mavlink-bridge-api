<template>
  <div class="sidebar-container">
    <!-- Sidebar header -->
    <div class="sidebar-header">
      <div v-if="!mini" class="sidebar-title">
        <q-icon name="grass" size="24px" class="q-mr-sm" />
        <span class="text-weight-medium">YardRover</span>
      </div>

      <!-- Mini toggle button -->
      <q-btn
        flat
        dense
        round
        :icon="mini ? 'keyboard_arrow_right' : 'keyboard_arrow_left'"
        class="mini-toggle-btn"
        :class="{ 'mini-toggle-btn--mini': mini }"
        @click="$emit('toggle-mini')"
      />
    </div>

    <!-- Navigation menu -->
    <q-list class="sidebar-nav">
      <!-- Dashboard -->
      <SidebarItem :to="{ name: 'dashboard' }" icon="dashboard" label="Dashboard" :mini="mini" />

      <!-- Machines section -->
      <SidebarSection
        :mini="mini"
        title="Machines"
        icon="precision_manufacturing"
        :expanded="machinesSectionExpanded"
        @toggle="machinesSectionExpanded = !machinesSectionExpanded"
      >
        <SidebarItem
          :to="{ name: 'machines' }"
          icon="view_list"
          label="All Machines"
          :mini="mini"
          :indent="true"
        />
        <SidebarItem
          :to="{ name: 'machine-control' }"
          icon="gamepad"
          label="Control Panel"
          :mini="mini"
          :indent="true"
        />
        <SidebarItem
          :to="{ name: 'machine-status' }"
          icon="monitor_heart"
          label="Status Monitor"
          :mini="mini"
          :indent="true"
          :badge="onlineMachinesCount"
        />
      </SidebarSection>

      <!-- Tasks section -->
      <SidebarSection
        :mini="mini"
        title="Tasks"
        icon="assignment"
        :expanded="tasksSectionExpanded"
        @toggle="tasksSectionExpanded = !tasksSectionExpanded"
      >
        <SidebarItem
          :to="{ name: 'tasks' }"
          icon="list_alt"
          label="Task Queue"
          :mini="mini"
          :indent="true"
          :badge="activeTasks"
        />
        <SidebarItem
          :to="{ name: 'task-scheduler' }"
          icon="schedule"
          label="Scheduler"
          :mini="mini"
          :indent="true"
        />
        <SidebarItem
          :to="{ name: 'task-history' }"
          icon="history"
          label="History"
          :mini="mini"
          :indent="true"
        />
      </SidebarSection>

      <!-- Yard section -->
      <SidebarSection
        :mini="mini"
        title="Yard"
        icon="map"
        :expanded="yardSectionExpanded"
        @toggle="yardSectionExpanded = !yardSectionExpanded"
      >
        <SidebarItem
          :to="{ name: 'yard-overview' }"
          icon="terrain"
          label="Overview"
          :mini="mini"
          :indent="true"
        />
        <SidebarItem
          :to="{ name: 'yard-zones' }"
          icon="crop_free"
          label="Zones"
          :mini="mini"
          :indent="true"
        />
        <SidebarItem
          :to="{ name: 'yard-weather' }"
          icon="wb_sunny"
          label="Weather"
          :mini="mini"
          :indent="true"
        />
      </SidebarSection>

      <!-- Separator -->
      <q-separator class="q-my-md" />

      <!-- Settings -->
      <SidebarItem :to="{ name: 'settings' }" icon="settings" label="Settings" :mini="mini" />

      <!-- Help -->
      <SidebarItem :to="{ name: 'help' }" icon="help" label="Help & Support" :mini="mini" />
    </q-list>

    <!-- Sidebar footer -->
    <div class="sidebar-footer">
      <div v-if="!mini" class="connection-info">
        <q-chip
          :color="connectionStatus === 'connected' ? 'positive' : 'negative'"
          text-color="white"
          size="sm"
          dense
        >
          <q-icon :name="connectionStatus === 'connected' ? 'wifi' : 'wifi_off'" left />
          {{ connectionStatus }}
        </q-chip>
      </div>

      <!-- Theme toggle -->
      <q-btn
        flat
        dense
        round
        :icon="isDark ? 'light_mode' : 'dark_mode'"
        class="theme-toggle"
        :class="{ 'theme-toggle--mini': mini }"
        @click="toggleTheme"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useUIStore, useStoreComputeds } from '@/stores'
import { useRealTime } from '@/stores/composables/useRealTime'

// Components
import SidebarItem from './SidebarItem.vue'
import SidebarSection from './SidebarSection.vue'

// Props
interface Props {
  mini: boolean
}

const props = defineProps<Props>()

// Emits
defineEmits<{
  'toggle-mini': []
}>()

// Composables
const ui = useUIStore()
const { dashboardSummary } = useStoreComputeds()
const realtime = useRealTime()

// Local state for section expansion
const machinesSectionExpanded = ref(true)
const tasksSectionExpanded = ref(true)
const yardSectionExpanded = ref(false)

// Computed properties
const isDark = computed(() => ui.currentTheme === 'dark')
const connectionStatus = computed(() => realtime.connectionStatus)

const onlineMachinesCount = computed(() => {
  const count = dashboardSummary.value.machinesOnline
  return count > 0 ? count.toString() : undefined
})

const activeTasks = computed(() => {
  const count = dashboardSummary.value.activeTasks
  return count > 0 ? count.toString() : undefined
})

// Methods
const toggleTheme = () => {
  ui.toggleTheme()
}
</script>

<style lang="scss" scoped>
.sidebar-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: inherit;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);

  .body--dark & {
    border-bottom-color: rgba(255, 255, 255, 0.12);
  }
}

.sidebar-title {
  display: flex;
  align-items: center;
  font-size: 1.1rem;
  color: var(--q-primary);
}

.mini-toggle-btn {
  transition: all 0.3s ease;

  &--mini {
    margin: 0 auto;
  }
}

.sidebar-nav {
  flex: 1;
  padding: 16px 8px;
  overflow-y: auto;
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  gap: 12px;

  .body--dark & {
    border-top-color: rgba(255, 255, 255, 0.12);
  }
}

.connection-info {
  display: flex;
  justify-content: center;
}

.theme-toggle {
  align-self: center;

  &--mini {
    margin: 0 auto;
  }
}

// Scrollbar styling
.sidebar-nav {
  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 2px;

    .body--dark & {
      background: rgba(255, 255, 255, 0.2);
    }
  }

  &::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.3);

    .body--dark & {
      background: rgba(255, 255, 255, 0.3);
    }
  }
}

// Responsive adjustments
@media (max-width: 1023px) {
  .sidebar-header {
    padding: 12px 16px;
  }

  .sidebar-nav {
    padding: 12px 8px;
  }

  .sidebar-footer {
    padding: 12px 16px;
  }
}
</style>

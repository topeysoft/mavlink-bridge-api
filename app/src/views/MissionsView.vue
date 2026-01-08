<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import MissionsToolbar from '@/components/missions/MissionsToolbar.vue'
import MissionTemplateCard from '@/components/missions/MissionTemplateCard.vue'
import MissionCard from '@/components/missions/MissionCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import SkeletonCard from '@/components/common/SkeletonCard.vue'
import { useMissionsStore } from '@/stores/missions'
import { useZonesStore } from '@/stores/zones'
import { useFeaturesStore } from '@/stores/features'
import { useNotifications } from '@/composables/useNotifications'
import { useDialog } from '@/composables/useDialog'
import type { Mission } from '@/types'

const router = useRouter()

const { success, info, error } = useNotifications()
const dialog = useDialog()
const missionsStore = useMissionsStore()
const zonesStore = useZonesStore()
const featuresStore = useFeaturesStore()

interface MissionTemplate {
  id: number
  name: string
  emoji: string
  description: string
  estimatedTime: string
}

// Use store data
const missions = computed(() => missionsStore.missions)
const loading = computed(() => missionsStore.isLoading)
const storeError = computed(() => missionsStore.error)

// Watch for errors
watch(storeError, (err) => {
  if (err) {
    error(`Error loading missions: ${err}`)
  }
})

const templates = ref<MissionTemplate[]>([
  {
    id: 1,
    name: 'Weekly Lawn Mowing',
    emoji: '🌱',
    description: 'Regular lawn maintenance every week',
    estimatedTime: '~45 minutes'
  },
  {
    id: 2,
    name: 'Perimeter Patrol',
    emoji: '🚨',
    description: 'Security patrol around property boundaries',
    estimatedTime: '~30 minutes'
  },
  {
    id: 3,
    name: 'Snow Clearing',
    emoji: '❄️',
    description: 'Automated snow clearing when detected',
    estimatedTime: '~60 minutes'
  }
])

const filterStatus = ref('all')
const showTemplates = ref(false)

// Adapt Mission type to MissionCard format
interface DisplayMission {
  id: string
  name: string
  type: string
  status: 'active' | 'scheduled' | 'completed' | 'pending'
  progress?: number
  schedule?: string
  estimatedTime?: string
  zones: string[]
  trigger?: string
}

const displayMissions = computed<DisplayMission[]>(() => {
  return missions.value.map(mission => {
    // Get zone names from zone IDs
    const zoneNames = mission.zoneIds.map(id => {
      const zone = zonesStore.getZoneById(id)
      return zone?.name || id
    })

    // Format schedule based on type
    let schedule = ''
    if (mission.type === 'once') {
      schedule = `Once on ${new Date(mission.schedule.startTime).toLocaleString()}`
    } else if (mission.type === 'daily') {
      schedule = `Daily at ${new Date(mission.schedule.startTime).toLocaleTimeString()}`
    } else if (mission.type === 'weekly' && mission.schedule.daysOfWeek) {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const dayNames = mission.schedule.daysOfWeek.map(d => days[d]).join(', ')
      schedule = `Weekly on ${dayNames} at ${new Date(mission.schedule.startTime).toLocaleTimeString()}`
    } else if (mission.type === 'monthly' && mission.schedule.dayOfMonth) {
      schedule = `Monthly on day ${mission.schedule.dayOfMonth} at ${new Date(mission.schedule.startTime).toLocaleTimeString()}`
    }

    return {
      id: mission.id,
      name: mission.name,
      type: mission.type,
      status: mission.enabled ? 'scheduled' : 'pending',
      schedule,
      zones: zoneNames,
      trigger: mission.priority !== 'normal' ? `Priority: ${mission.priority}` : undefined
    }
  })
})

const filteredMissions = computed(() => {
  let filtered = displayMissions.value

  if (filterStatus.value === 'all') {
    return filtered
  }

  // Filter by status
  return filtered.filter(mission => mission.status === filterStatus.value)
})

const handleCreateMission = () => {
  // Navigate to mission editor page instead of opening modal
  router.push('/missions/create')
}

const handleViewTemplates = () => {
  showTemplates.value = !showTemplates.value
}

const handleFilterStatus = (status: string) => {
  filterStatus.value = status
}

const handleUseTemplate = (templateId: number) => {
  console.log('Use template:', templateId)
}

const handleEditMission = async (id: string) => {
  console.log('Edit mission:', id)
  // TODO: Navigate to mission editor with mission ID
}

const handleStartMission = async (id: string) => {
  // TODO: Implement mission execution via MAVLink
  info('Mission execution coming soon')
}

const handlePauseMission = async (id: string) => {
  // TODO: Implement mission pause
  info('Mission pause coming soon')
}

const handleCancelMission = async (id: string) => {
  // TODO: Implement mission cancel
  info('Mission cancel coming soon')
}

const handleDeleteMission = async (id: string) => {
  const mission = missionsStore.getMissionById.value(id)
  if (!mission) return

  const confirmed = await dialog.confirm(
    `Are you sure you want to delete mission "${mission.name}"? This action cannot be undone.`,
    'Confirm Delete'
  )

  if (confirmed) {
    try {
      await missionsStore.deleteMission(id)
      success(`Mission "${mission.name}" deleted successfully`)
    } catch (err) {
      error(`Failed to delete mission: ${(err as Error).message}`)
    }
  }
}

const handleExport = () => {
  const dataStr = JSON.stringify(missions.value, null, 2)
  const dataBlob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(dataBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = `yardrover-missions-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  success(`${missions.value.length} missions exported successfully`)
}
</script>

<template>
  <div class="missions-view">
    <MissionsToolbar
      @create-mission="handleCreateMission"
      @view-templates="handleViewTemplates"
      @filter-status="handleFilterStatus"
      @export="handleExport"
    />

    <div v-if="showTemplates" class="templates-section">
      <h2 class="section-title">Mission Templates</h2>
      <div class="templates-grid">
        <MissionTemplateCard
          v-for="template in templates"
          :key="template.id"
          :template="template"
          @use="handleUseTemplate"
        />
      </div>
    </div>

    <!-- Missions Section with Skeleton Loaders -->
    <div v-if="loading" class="missions-section">
      <h2 class="section-title">All Missions</h2>
      <div class="missions-grid">
        <SkeletonCard v-for="i in 3" :key="i" variant="default" />
      </div>
    </div>

    <div v-else-if="filteredMissions.length > 0" class="missions-section">
      <h2 class="section-title">
        {{ filterStatus === 'all' ? 'All Missions' : `${filterStatus} Missions` }}
      </h2>
      <div class="missions-grid">
        <MissionCard
          v-for="mission in filteredMissions"
          :key="mission.id"
          :mission="mission"
          @edit="handleEditMission"
          @start="handleStartMission"
          @pause="handlePauseMission"
          @cancel="handleCancelMission"
          @delete="handleDeleteMission"
        />
      </div>
    </div>

    <EmptyState
      v-else-if="!showTemplates && !loading"
      icon="box"
      title="No Missions Found"
      message="Create your first mission or use a template to get started"
      action-label="Create Mission"
      @action="handleCreateMission"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/mixins' as *;

.missions-view {
  padding: var(--spacing-xl);
}

.templates-section,
.missions-section {
  margin-bottom: var(--spacing-2xl);
}

.section-title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--spacing-lg);
}

.templates-grid {
  @include auto-grid(300px);
  gap: var(--spacing-lg);
}

.missions-grid {
  @include auto-grid(350px);
  gap: var(--spacing-lg);
}
</style>

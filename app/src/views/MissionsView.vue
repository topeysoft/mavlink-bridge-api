<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import MissionsToolbar from '@/components/missions/MissionsToolbar.vue'
import MissionTemplateCard from '@/components/missions/MissionTemplateCard.vue'
import MissionCard from '@/components/missions/MissionCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import SkeletonCard from '@/components/common/SkeletonCard.vue'
import { useMissionsStore } from '@/stores/missions'
import { useFeaturesStore } from '@/stores/features'
import { useNotifications } from '@/composables/useNotifications'

const router = useRouter()

const { success, info } = useNotifications()
const missionsStore = useMissionsStore()
const featuresStore = useFeaturesStore()

// Loading state
const loading = ref(true)

interface Mission {
  id: number
  name: string
  type: string
  status: 'active' | 'scheduled' | 'completed' | 'pending'
  progress?: number
  schedule?: string
  estimatedTime?: string
  zones: string[]
  trigger?: string
}

interface MissionTemplate {
  id: number
  name: string
  emoji: string
  description: string
  estimatedTime: string
}

const missions = ref<Mission[]>([
  {
    id: 1,
    name: 'Daily Front Lawn Mowing',
    type: 'Lawn Mowing',
    status: 'active',
    progress: 35,
    estimatedTime: '~25 min remaining',
    zones: ['Front Lawn', 'Side Path']
  },
  {
    id: 2,
    name: 'Weekly Garden Maintenance',
    type: 'Garden Care',
    status: 'scheduled',
    schedule: 'Every Sunday at 8:00 AM',
    zones: ['Back Garden'],
    trigger: 'Weather: No rain'
  },
  {
    id: 3,
    name: 'Perimeter Patrol',
    type: 'Patrol',
    status: 'scheduled',
    schedule: 'Daily at 6:00 PM',
    zones: ['All Zones']
  }
])

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

const filteredMissions = computed(() => {
  if (filterStatus.value === 'all') {
    return missions.value
  }
  return missions.value.filter(mission => mission.status === filterStatus.value)
})

const handleCreateMission = () => {
  // Navigate to mission editor page instead of opening modal
  router.push('/missions/create')
}

const handleOpenMissionPlanner = () => {
  router.push('/missions/planner')
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

const handleEditMission = (id: number) => {
  console.log('Edit mission:', id)
}

const handleStartMission = (id: number) => {
  const mission = missions.value.find(m => m.id === id)
  if (mission) {
    mission.status = 'active'
    mission.progress = 0
  }
}

const handlePauseMission = (id: number) => {
  const mission = missions.value.find(m => m.id === id)
  if (mission) {
    mission.status = 'pending'
  }
}

const handleCancelMission = (id: number) => {
  const mission = missions.value.find(m => m.id === id)
  if (mission) {
    mission.status = 'scheduled'
    mission.progress = undefined
  }
}

const handleDeleteMission = (id: number) => {
  missions.value = missions.value.filter(m => m.id !== id)
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

// Simulate loading data
onMounted(async () => {
  await new Promise(resolve => setTimeout(resolve, 600))
  loading.value = false
})
</script>

<template>
  <div class="missions-view">
    <MissionsToolbar
      :show-mission-planner="featuresStore.isFeatureEnabled('missionPlanner')"
      @create-mission="handleCreateMission"
      @open-mission-planner="handleOpenMissionPlanner"
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

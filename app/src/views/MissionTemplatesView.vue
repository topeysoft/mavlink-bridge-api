<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { UnifiedMissionWizard } from '@/components/missions/wizard'
import { useFeaturesStore } from '@/stores/features'
import { useDialog } from '@/composables/useDialog'
import { useNotifications } from '@/composables/useNotifications'

const router = useRouter()
const route = useRoute()
const dialog = useDialog()
const { success } = useNotifications()
const featuresStore = useFeaturesStore()

const isConsumerMode = computed(() => featuresStore.userMode === 'consumer')

// Get template ID from route params if present
const templateId = computed(() => route.params.templateId as string | undefined)

// Get mission ID from route params for edit mode
const missionId = computed(() => route.params.id as string | undefined)

// Check for recurring pre-selection from query param
const preSelectRecurring = computed(() => route.query.recurring === 'true')

async function handleWizardComplete(createdMissionId: string) {
  const missionLabel = isConsumerMode.value ? 'job' : 'mission'
  const isEdit = !!missionId.value

  if (isEdit) {
    success(isConsumerMode.value ? 'Job updated successfully' : 'Mission updated successfully')
    router.push({ name: 'missions' })
    return
  }

  const startNow = await dialog.confirm(
    isConsumerMode.value
      ? 'Your job was created! Would you like to start it now?'
      : 'Mission created successfully. Would you like to start it now?',
    isConsumerMode.value ? 'Job Created' : 'Mission Created',
    {
      confirmText: isConsumerMode.value ? 'Start Now' : 'Start Mission',
      cancelText: 'Keep Scheduled',
      variant: 'success'
    }
  )

  if (startNow) {
    // TODO: Start the mission immediately via MAVLink
    success(isConsumerMode.value ? 'Starting your job...' : 'Starting mission...')
  } else {
    success(isConsumerMode.value ? 'Job scheduled successfully' : 'Mission scheduled successfully')
  }

  router.push({ name: 'missions' })
}

function handleWizardCancel() {
  router.push({ name: 'missions' })
}
</script>

<template>
  <div class="mission-wizard-view">
    <UnifiedMissionWizard
      :template-id="templateId"
      :mission-id="missionId"
      :pre-select-recurring="preSelectRecurring"
      @complete="handleWizardComplete"
      @cancel="handleWizardCancel"
    />
  </div>
</template>

<style scoped lang="scss">
.mission-wizard-view {
  height: 100%;
  min-height: calc(100vh - 64px);
}
</style>

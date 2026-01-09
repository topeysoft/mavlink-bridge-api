<script setup lang="ts">
import { computed } from 'vue'
import UnifiedConnectionFlow from '@/components/connection/UnifiedConnectionFlow.vue'
import type { UserType } from '@/stores/onboarding'

interface Props {
  userType: UserType
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'complete': []
}>()

const userMode = computed(() => props.userType === 'consumer' ? 'consumer' : 'technical')

function handleConnected(device: { name: string | null; url: string | null }) {
  console.log('[ConnectionStep] Connected to device:', device)
  emit('complete')
}
</script>

<template>
  <div class="connection-step">
    <UnifiedConnectionFlow
      mode="onboarding"
      :user-mode="userMode"
      :show-header="true"
      :auto-start="false"
      @connected="handleConnected"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;
@use '@/assets/styles/mixins' as *;

.connection-step {
  padding: var(--spacing-xl);
  min-height: 500px;
  display: flex;
  flex-direction: column;

  @include mobile {
    padding: var(--spacing-md);
  }
}
</style>

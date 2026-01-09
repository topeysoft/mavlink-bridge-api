<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useOnboardingStore } from '@/stores/onboarding'
import { useAuthStore } from '@/stores/auth'
import SetupWizard from '@/components/onboarding/SetupWizard.vue'

const router = useRouter()
const onboardingStore = useOnboardingStore()
const authStore = useAuthStore()

onMounted(() => {
  // If onboarding is already complete and user is authenticated, redirect to dashboard
  if (onboardingStore.isOnboardingComplete && authStore.isAuthenticated) {
    router.push('/')
  }
})
</script>

<template>
  <div class="onboarding-page">
    <SetupWizard />
  </div>
</template>

<style scoped lang="scss">
.onboarding-page {
  min-height: 100vh;
  width: 100%;
}
</style>

<script setup lang="ts">
import Skeleton from './Skeleton.vue'

interface Props {
  variant?: 'stat' | 'mission' | 'zone' | 'default'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default'
})
</script>

<template>
  <div class="skeleton-card-wrapper" :class="`skeleton-card-${variant}`">
    <!-- Stat Card Skeleton -->
    <template v-if="variant === 'stat'">
      <div class="skeleton-stat-layout">
        <Skeleton variant="circular" width="56px" height="56px" :lines="1" />
        <div class="skeleton-stat-content">
          <Skeleton variant="text" width="60%" height="1.5rem" :lines="1" />
          <Skeleton variant="text" width="80%" height="0.875rem" :lines="1" />
        </div>
      </div>
    </template>

    <!-- Mission/Zone Card Skeleton -->
    <template v-else-if="variant === 'mission' || variant === 'zone'">
      <div class="skeleton-mission-layout">
        <div class="skeleton-mission-header">
          <Skeleton variant="text" width="70%" height="1.25rem" :lines="1" />
          <Skeleton variant="rectangular" width="60px" height="24px" :lines="1" />
        </div>
        <Skeleton variant="text" width="100%" height="0.875rem" :lines="2" />
        <div class="skeleton-mission-footer">
          <Skeleton variant="rectangular" width="80px" height="32px" :lines="1" />
          <Skeleton variant="rectangular" width="80px" height="32px" :lines="1" />
        </div>
      </div>
    </template>

    <!-- Default Card Skeleton -->
    <template v-else>
      <div class="skeleton-default-layout">
        <Skeleton variant="text" width="60%" height="1.5rem" :lines="1" />
        <Skeleton variant="text" width="100%" height="1rem" :lines="3" />
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/mixins' as *;

.skeleton-card-wrapper {
  @include card;
  background: var(--bg-primary);
  min-height: 120px;
}

.skeleton-stat-layout {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);

  .skeleton-stat-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }
}

.skeleton-mission-layout {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);

  .skeleton-mission-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .skeleton-mission-footer {
    display: flex;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-sm);
  }
}

.skeleton-default-layout {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
</style>

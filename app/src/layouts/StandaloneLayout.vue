<template>
  <div class="standalone-layout">
    <!-- Main content area -->
    <div class="standalone-content">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useThemeStore } from '@/stores/theme';

interface Props {
  title?: string;
}

withDefaults(defineProps<Props>(), {
  title: 'YardRover',
});

const themeStore = useThemeStore();
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;
@use '@/assets/styles/mixins' as *;
@use 'sass:color';

.standalone-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(
    135deg,
    $primary 0%,
    color.adjust($primary, $lightness: -15%) 100%
  );
}

.standalone-header {
  @include flex-between;
  padding: var(--spacing-xl);
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);

  .logo-section {
    @include flex-center;
    gap: var(--spacing-md);
    color: var(--primary-green);
  }

  .logo-icon {
    width: 48px;
    height: 48px;
  }

  .logo-text {
    font-size: var(--font-size-3xl);
    font-weight: 700;
    margin: 0;
  }

  .theme-toggle {
    @include flex-center;
    padding: var(--spacing-sm);
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    cursor: pointer;
    color: var(--text-primary);
    transition: all 0.2s;

    svg {
      width: 24px;
      height: 24px;
    }

    &:hover {
      background: var(--bg-tertiary);
      transform: translateY(-1px);
    }
  }
}

.standalone-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

// Mobile responsive
@include mobile {
  .standalone-header {
    padding: var(--spacing-lg);

    .logo-icon {
      width: 36px;
      height: 36px;
    }

    .logo-text {
      font-size: var(--font-size-2xl);
    }
  }

  .standalone-content {
    padding: 1rem;
  }
}
</style>

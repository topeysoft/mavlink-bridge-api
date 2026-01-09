<template>
  <div :class="['auth-badge', `auth-badge--${status}`]" :title="tooltip">
    <span class="auth-badge__icon">{{ icon }}</span>
    <span class="auth-badge__text">{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  status: 'needs_setup' | 'needs_login' | 'authenticated' | 'unknown'
  checking?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  checking: false
})

const icon = computed(() => {
  if (props.checking) return '⏳'

  switch (props.status) {
    case 'needs_setup':
      return '🔧'
    case 'needs_login':
      return '🔒'
    case 'authenticated':
      return '✓'
    case 'unknown':
    default:
      return '❓'
  }
})

const text = computed(() => {
  if (props.checking) return 'Checking...'

  switch (props.status) {
    case 'needs_setup':
      return 'Setup Required'
    case 'needs_login':
      return 'Login Required'
    case 'authenticated':
      return 'Authenticated'
    case 'unknown':
    default:
      return 'Unknown'
  }
})

const tooltip = computed(() => {
  if (props.checking) return 'Checking authentication status...'

  switch (props.status) {
    case 'needs_setup':
      return 'This device needs initial setup. Click to configure your admin credentials.'
    case 'needs_login':
      return 'This device requires authentication. Click to login with your API key.'
    case 'authenticated':
      return 'You are authenticated and can access this device.'
    case 'unknown':
    default:
      return 'Unable to determine authentication status.'
  }
})
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.auth-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: 12px;
  font-size: 0.8125rem;
  font-weight: 600;
  white-space: nowrap;
  transition: all 0.2s;

  &__icon {
    font-size: 1rem;
    line-height: 1;
  }

  &__text {
    line-height: 1;
  }

  // Status variants
  &--needs_setup {
    background: #fff3cd;
    color: #856404;
    border: 1px solid #ffeaa7;
  }

  &--needs_login {
    background: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
  }

  &--authenticated {
    background: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
  }

  &--unknown {
    background: #e2e3e5;
    color: #383d41;
    border: 1px solid #d6d8db;
  }
}

// Responsive
@media (max-width: 640px) {
  .auth-badge {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;

    &__icon {
      font-size: 0.875rem;
    }
  }
}
</style>

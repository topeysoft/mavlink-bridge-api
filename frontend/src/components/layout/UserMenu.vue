<template>
  <div class="user-menu">
    <q-btn flat round dense class="user-menu__btn" @click="toggleMenu">
      <q-avatar size="32px" class="user-menu__avatar">
        <img v-if="user?.avatar" :src="user.avatar" :alt="user.name" />
        <q-icon v-else name="person" size="20px" />
      </q-avatar>
    </q-btn>

    <!-- User menu dropdown -->
    <q-menu
      v-model="showMenu"
      anchor="bottom right"
      self="top right"
      :offset="[0, 8]"
      class="user-menu__dropdown"
    >
      <q-card class="user-menu__card">
        <!-- User info section -->
        <q-card-section class="user-menu__info">
          <div class="row items-center q-gutter-md">
            <q-avatar size="40px">
              <img v-if="user?.avatar" :src="user.avatar" :alt="user.name" />
              <q-icon v-else name="person" size="24px" />
            </q-avatar>
            <div class="column">
              <div class="text-weight-medium">
                {{ user?.name || 'Guest User' }}
              </div>
              <div class="text-caption text-grey-6">
                {{ user?.email || 'Not signed in' }}
              </div>
            </div>
          </div>
        </q-card-section>

        <q-separator />

        <!-- Menu items -->
        <q-list class="user-menu__list">
          <!-- Profile -->
          <q-item v-ripple clickable @click="navigateToProfile">
            <q-item-section avatar>
              <q-icon name="person" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Profile</q-item-label>
            </q-item-section>
          </q-item>

          <!-- Account Settings -->
          <q-item v-ripple clickable @click="navigateToAccountSettings">
            <q-item-section avatar>
              <q-icon name="manage_accounts" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Account Settings</q-item-label>
            </q-item-section>
          </q-item>

          <!-- Preferences -->
          <q-item v-ripple clickable @click="navigateToPreferences">
            <q-item-section avatar>
              <q-icon name="tune" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Preferences</q-item-label>
            </q-item-section>
          </q-item>

          <q-separator class="q-my-sm" />

          <!-- Help & Support -->
          <q-item v-ripple clickable @click="navigateToHelp">
            <q-item-section avatar>
              <q-icon name="help" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Help & Support</q-item-label>
            </q-item-section>
          </q-item>

          <!-- About -->
          <q-item v-ripple clickable @click="showAbout">
            <q-item-section avatar>
              <q-icon name="info" />
            </q-item-section>
            <q-item-section>
              <q-item-label>About YardRover</q-item-label>
            </q-item-section>
          </q-item>

          <q-separator class="q-my-sm" />

          <!-- Logout -->
          <q-item v-ripple clickable class="text-negative" @click="handleLogout">
            <q-item-section avatar>
              <q-icon name="logout" color="negative" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Sign Out</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </q-menu>

    <!-- About dialog -->
    <q-dialog v-model="showAboutDialog" class="user-menu__about-dialog">
      <q-card style="min-width: 350px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">About YardRover</div>
          <q-space />
          <q-btn v-close-popup flat round dense icon="close" />
        </q-card-section>

        <q-card-section>
          <div class="text-center q-mb-md">
            <q-icon name="grass" size="48px" color="primary" />
          </div>
          <div class="text-center">
            <div class="text-h6 q-mb-sm">YardRover</div>
            <div class="text-body2 text-grey-6 q-mb-md">Intelligent Yard Management System</div>
            <div class="text-caption">Version {{ appVersion }}</div>
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useQuasar } from 'quasar'

// Composables
const router = useRouter()
const auth = useAuthStore()
const $q = useQuasar()

// Local state
const showMenu = ref(false)
const showAboutDialog = ref(false)

// Computed properties
const user = computed(() => auth.user)
const appVersion = computed(() => '1.0.0') // TODO: Get from package.json or environment

// Methods
const toggleMenu = () => {
  showMenu.value = !showMenu.value
}

const navigateToProfile = () => {
  router.push({ name: 'profile' })
  showMenu.value = false
}

const navigateToAccountSettings = () => {
  router.push({ name: 'settings', query: { tab: 'account' } })
  showMenu.value = false
}

const navigateToPreferences = () => {
  router.push({ name: 'settings', query: { tab: 'preferences' } })
  showMenu.value = false
}

const navigateToHelp = () => {
  router.push({ name: 'help' })
  showMenu.value = false
}

const showAbout = () => {
  showAboutDialog.value = true
  showMenu.value = false
}

const handleLogout = async () => {
  try {
    showMenu.value = false

    // Show confirmation dialog
    const confirmed = await new Promise<boolean>(resolve => {
      $q.dialog({
        title: 'Sign Out',
        message: 'Are you sure you want to sign out?',
        cancel: true,
        persistent: true
      })
        .onOk(() => resolve(true))
        .onCancel(() => resolve(false))
    })

    if (confirmed) {
      await auth.logout()
      router.push({ name: 'login' })
    }
  } catch (error) {
    console.error('Logout error:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to sign out. Please try again.'
    })
  }
}
</script>

<style lang="scss" scoped>
.user-menu {
  position: relative;
}

.user-menu__btn {
  color: inherit;
  transition: all 0.2s ease;

  &:hover {
    color: var(--q-primary);
  }
}

.user-menu__avatar {
  border: 2px solid transparent;
  transition: border-color 0.2s ease;

  .user-menu__btn:hover & {
    border-color: var(--q-primary);
  }
}

.user-menu__dropdown {
  .q-menu {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  }
}

.user-menu__card {
  min-width: 250px;
}

.user-menu__info {
  padding: 16px 20px;
  background-color: rgba(var(--q-primary-rgb), 0.05);

  .body--dark & {
    background-color: rgba(var(--q-primary-rgb), 0.1);
  }
}

.user-menu__list {
  padding: 8px 0;

  .q-item {
    padding: 8px 20px;
    min-height: 44px;
    transition: background-color 0.2s ease;

    &:hover {
      background-color: rgba(0, 0, 0, 0.05);

      .body--dark & {
        background-color: rgba(255, 255, 255, 0.05);
      }
    }
  }

  .q-item-label {
    font-weight: 500;
    font-size: 0.875rem;
  }
}

// Dark mode adjustments
.body--dark {
  .user-menu__dropdown .q-menu {
    box-shadow: 0 8px 24px rgba(255, 255, 255, 0.1);
  }
}

// Focus styles
.user-menu__btn:focus-visible {
  outline: 2px solid var(--q-primary);
  outline-offset: 2px;
}

.q-item:focus-visible {
  outline: 2px solid var(--q-primary);
  outline-offset: -2px;
}
</style>

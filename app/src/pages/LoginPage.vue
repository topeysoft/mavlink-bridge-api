<template>
  <q-page class="login-page nature-gradient flex flex-center">
    <div class="login-container">
      <!-- Logo and Branding -->
      <div class="text-center q-mb-lg">
        <div class="logo-container q-mb-md">
          <q-icon name="grass" size="80px" color="primary" />
        </div>
        <h1 class="text-h3 text-primary q-mb-xs">YardRover</h1>
        <p class="text-body1 text-grey-7">Autonomous Yard Management System</p>
      </div>

      <!-- Login Form -->
      <q-card class="login-card nature-card">
        <q-card-section class="q-pa-lg">
          <div class="text-h6 text-center text-primary q-mb-md">
            Welcome Back
          </div>

          <q-form @submit.prevent="handleLogin" class="q-gutter-md">
            <q-input
              v-model="credentials.username"
              label="Username"
              outlined
              :rules="[val => !!val || 'Username is required']"
              autofocus
            >
              <template v-slot:prepend>
                <q-icon name="person" />
              </template>
            </q-input>

            <q-input
              v-model="credentials.password"
              label="Password"
              :type="showPassword ? 'text' : 'password'"
              outlined
              :rules="[val => !!val || 'Password is required']"
            >
              <template v-slot:prepend>
                <q-icon name="lock" />
              </template>
              <template v-slot:append>
                <q-icon
                  :name="showPassword ? 'visibility_off' : 'visibility'"
                  class="cursor-pointer"
                  @click="showPassword = !showPassword"
                />
              </template>
            </q-input>

            <div class="row items-center justify-between">
              <q-checkbox
                v-model="rememberMe"
                label="Remember me"
                color="primary"
              />
              <q-btn
                flat
                color="primary"
                label="Forgot password?"
                size="sm"
                @click="showForgotPassword"
              />
            </div>

            <q-btn
              type="submit"
              color="primary"
              label="Sign In"
              class="full-width"
              :loading="isLoading"
              size="lg"
            />
          </q-form>

          <!-- Demo Credentials -->
          <q-separator class="q-my-md" />
          <div class="text-center">
            <div class="text-caption text-grey q-mb-sm">Demo Credentials</div>
            <div class="row q-gutter-xs justify-center">
              <q-chip
                clickable
                color="primary"
                text-color="white"
                size="sm"
                @click="setDemoCredentials('admin')"
              >
                Admin
              </q-chip>
              <q-chip
                clickable
                color="secondary"
                text-color="white"
                size="sm"
                @click="setDemoCredentials('operator')"
              >
                Operator
              </q-chip>
              <q-chip
                clickable
                color="grey"
                text-color="white"
                size="sm"
                @click="setDemoCredentials('viewer')"
              >
                Viewer
              </q-chip>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- Footer -->
      <div class="text-center q-mt-lg">
        <p class="text-caption text-grey">
          YardRover Control Panel v1.0.0<br>
          &copy; 2025 YardRover Systems. All rights reserved.
        </p>
        <div class="q-mt-sm">
          <q-btn
            flat
            color="primary"
            label="Help"
            size="sm"
            @click="showHelp"
          />
          <q-btn
            flat
            color="primary"
            label="About"
            size="sm"
            @click="showAbout"
            class="q-ml-sm"
          />
        </div>
      </div>
    </div>

    <!-- Help Dialog -->
    <q-dialog v-model="showHelpDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">
            <q-icon name="help" class="q-mr-sm" />
            Login Help
          </div>
        </q-card-section>
        
        <q-card-section>
          <div class="text-body1 q-mb-md">
            Use these demo credentials to explore the YardRover system:
          </div>
          
          <q-list>
            <q-item>
              <q-item-section avatar>
                <q-chip color="primary" text-color="white" size="sm">Admin</q-chip>
              </q-item-section>
              <q-item-section>
                <q-item-label>Username: admin</q-item-label>
                <q-item-label caption>Password: admin</q-item-label>
                <q-item-label caption class="text-grey">Full system access</q-item-label>
              </q-item-section>
            </q-item>
            
            <q-item>
              <q-item-section avatar>
                <q-chip color="secondary" text-color="white" size="sm">Op</q-chip>
              </q-item-section>
              <q-item-section>
                <q-item-label>Username: operator</q-item-label>
                <q-item-label caption>Password: operator</q-item-label>
                <q-item-label caption class="text-grey">Control and task management</q-item-label>
              </q-item-section>
            </q-item>
            
            <q-item>
              <q-item-section avatar>
                <q-chip color="grey" text-color="white" size="sm">View</q-chip>
              </q-item-section>
              <q-item-section>
                <q-item-label>Username: viewer</q-item-label>
                <q-item-label caption>Password: viewer</q-item-label>
                <q-item-label caption class="text-grey">Read-only access</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        
        <q-card-actions align="right">
          <q-btn flat label="Close" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- About Dialog -->
    <q-dialog v-model="showAboutDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6 text-center">
            <q-icon name="grass" size="40px" color="primary" class="q-mr-sm" />
            YardRover
          </div>
        </q-card-section>
        
        <q-card-section>
          <div class="text-center">
            <p class="text-body1">
              Autonomous Yard Management System
            </p>
            <p class="text-body2">
              Version 1.0.0<br>
              Built with Vue 3, Quasar 2, and TypeScript
            </p>
            <p class="text-caption text-grey">
              Designed for efficient and intelligent yard maintenance
            </p>
          </div>
        </q-card-section>
        
        <q-card-actions align="right">
          <q-btn flat label="Close" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Background Animation -->
    <div class="background-animation">
      <div class="floating-leaf leaf-1">
        <q-icon name="eco" size="24px" color="rgba(76, 175, 80, 0.3)" />
      </div>
      <div class="floating-leaf leaf-2">
        <q-icon name="local_florist" size="20px" color="rgba(76, 175, 80, 0.2)" />
      </div>
      <div class="floating-leaf leaf-3">
        <q-icon name="park" size="28px" color="rgba(76, 175, 80, 0.25)" />
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';
import { Notify } from 'quasar';

const router = useRouter();
const userStore = useUserStore();

// State
const credentials = ref({
  username: '',
  password: ''
});

const showPassword = ref(false);
const rememberMe = ref(false);
const isLoading = ref(false);
const showHelpDialog = ref(false);
const showAboutDialog = ref(false);

// Methods
async function handleLogin() {
  if (!credentials.value.username || !credentials.value.password) {
    return;
  }

  isLoading.value = true;

  try {
    const result = await userStore.login(credentials.value);
    
    if (result.success) {
      Notify.create({
        type: 'positive',
        message: `Welcome back, ${userStore.userName}!`,
        position: 'top'
      });

      // Redirect to intended page or dashboard
      const redirect = router.currentRoute.value.query.redirect as string;
      await router.push(redirect || '/dashboard');
    } else {
      Notify.create({
        type: 'negative',
        message: result.error || 'Login failed',
        position: 'top'
      });
    }
  } catch (error) {
    Notify.create({
      type: 'negative',
      message: 'An error occurred during login',
      position: 'top'
    });
  } finally {
    isLoading.value = false;
  }
}

function setDemoCredentials(role: string) {
  credentials.value = {
    username: role,
    password: role
  };
}

function showForgotPassword() {
  Notify.create({
    type: 'info',
    message: 'This is a demo. Use the demo credentials provided.',
    position: 'top'
  });
}

function showHelp() {
  showHelpDialog.value = true;
}

function showAbout() {
  showAboutDialog.value = true;
}
</script>

<style lang="scss" scoped>
@import '@/assets/styles/variables';

.login-page {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
}

.login-container {
  width: 100%;
  max-width: 400px;
  padding: $spacing-lg;
  position: relative;
  z-index: 10;
}

.logo-container {
  display: inline-block;
  padding: $spacing-md;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  box-shadow: $shadow-sm;
}

.login-card {
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.95);
  box-shadow: $shadow-lg;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.background-animation {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.floating-leaf {
  position: absolute;
  animation-duration: 20s;
  animation-iteration-count: infinite;
  animation-timing-function: ease-in-out;

  &.leaf-1 {
    top: 10%;
    left: 10%;
    animation-name: float-1;
    animation-delay: 0s;
  }

  &.leaf-2 {
    top: 60%;
    right: 15%;
    animation-name: float-2;
    animation-delay: 7s;
  }

  &.leaf-3 {
    bottom: 20%;
    left: 20%;
    animation-name: float-3;
    animation-delay: 14s;
  }
}

@keyframes float-1 {
  0%, 100% {
    transform: translateY(0) rotate(0deg);
    opacity: 0.3;
  }
  25% {
    transform: translateY(-20px) rotate(90deg);
    opacity: 0.6;
  }
  50% {
    transform: translateY(0) rotate(180deg);
    opacity: 0.3;
  }
  75% {
    transform: translateY(20px) rotate(270deg);
    opacity: 0.6;
  }
}

@keyframes float-2 {
  0%, 100% {
    transform: translateX(0) rotate(0deg);
    opacity: 0.2;
  }
  50% {
    transform: translateX(-30px) rotate(180deg);
    opacity: 0.5;
  }
}

@keyframes float-3 {
  0%, 100% {
    transform: translate(0, 0) rotate(0deg);
    opacity: 0.25;
  }
  33% {
    transform: translate(20px, -15px) rotate(120deg);
    opacity: 0.5;
  }
  66% {
    transform: translate(-10px, 10px) rotate(240deg);
    opacity: 0.25;
  }
}

@media (max-width: $breakpoint-sm) {
  .login-container {
    padding: $spacing-md;
  }
}
</style>
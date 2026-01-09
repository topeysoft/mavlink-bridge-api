import { createRouter, createWebHistory } from 'vue-router'
import { authGuard, setupGuard, loginGuard, connectionGuard, onboardingGuard } from './guards'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // Onboarding route (unified setup flow)
    {
      path: '/onboarding',
      name: 'onboarding',
      component: () => import('../pages/OnboardingPage.vue'),
      beforeEnter: onboardingGuard,
      meta: { public: true, requiresConnection: false, requiresAuth: false },
    },
    // Legacy public routes (kept for backwards compatibility, but redirect to onboarding if appropriate)
    {
      path: '/connect',
      name: 'connect',
      component: () => import('../pages/ConnectionPage.vue'),
      beforeEnter: connectionGuard,
      meta: { public: true, requiresConnection: false, requiresAuth: false },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../pages/LoginPage.vue'),
      beforeEnter: loginGuard,
      meta: { public: true, requiresConnection: true, requiresAuth: false },
    },
    {
      path: '/setup',
      name: 'setup',
      component: () => import('../pages/SetupPage.vue'),
      beforeEnter: setupGuard,
      meta: { public: true, requiresConnection: true, requiresAuth: false },
    },
    // Protected routes (all require both connection and authentication)
    // Wrapped in AppLayout for sidebar and header
    {
      path: '/',
      component: () => import('../layouts/AppLayout.vue'),
      meta: { requiresConnection: true, requiresAuth: true },
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('../views/DashboardView.vue'),
        },
        {
          path: 'peripherals',
          name: 'peripherals',
          component: () => import('../views/PeripheralsView.vue'),
        },
        {
          path: 'zones',
          name: 'zones',
          component: () => import('../views/ZonesView.vue'),
        },
        {
          path: 'zones/edit/:id?',
          name: 'zone-editor',
          component: () => import('../views/ZoneEditorView.vue'),
        },
        {
          path: 'missions',
          name: 'missions',
          component: () => import('../views/MissionsView.vue'),
        },
        {
          path: 'missions/create',
          name: 'mission-editor',
          component: () => import('../views/MissionEditorView.vue'),
        },
        {
          path: 'control',
          name: 'control',
          component: () => import('../views/ControlView.vue'),
        },
        {
          path: 'monitoring',
          name: 'monitoring',
          component: () => import('../views/MonitoringView.vue'),
        },
        {
          path: 'schedule',
          name: 'schedule',
          component: () => import('../views/ScheduleView.vue'),
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('../views/SettingsView.vue'),
        },
        {
          path: 'parameters',
          name: 'parameters',
          component: () => import('../views/ParametersView.vue'),
        },
        {
          path: 'logs',
          name: 'logs',
          component: () => import('../views/LogsView.vue'),
        },
        {
          path: 'battery',
          name: 'battery',
          component: () => import('../views/BatteryView.vue'),
        },
        {
          path: 'weather',
          name: 'weather',
          component: () => import('../views/WeatherView.vue'),
        },
        {
          path: 'calibration',
          name: 'calibration',
          component: () => import('../views/CalibrationView.vue'),
        },
        {
          path: 'rtcm',
          name: 'rtcm',
          component: () => import('../views/RTCMView.vue'),
        },
      ],
    },
  ],
})

// Global navigation guard for authentication
router.beforeEach(authGuard)

export default router

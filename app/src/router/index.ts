import { createRouter, createWebHistory } from 'vue-router'
import { authGuard, setupGuard, loginGuard, connectionGuard } from './guards'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // Public routes (no auth or connection required initially)
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
    {
      path: '/',
      name: 'dashboard',
      component: () => import('../views/DashboardView.vue'),
      meta: { requiresConnection: true, requiresAuth: true },
    },
    {
      path: '/attachments',
      name: 'attachments',
      component: () => import('../views/AttachmentsView.vue'),
      meta: { requiresConnection: true, requiresAuth: true },
    },
    {
      path: '/zones',
      name: 'zones',
      component: () => import('../views/ZonesView.vue'),
      meta: { requiresConnection: true, requiresAuth: true },
    },
    {
      path: '/zones/edit/:id?',
      name: 'zone-editor',
      component: () => import('../views/ZoneEditorView.vue'),
      meta: { requiresConnection: true, requiresAuth: true },
    },
    {
      path: '/missions',
      name: 'missions',
      component: () => import('../views/MissionsView.vue'),
      meta: { requiresConnection: true, requiresAuth: true },
    },
    {
      path: '/missions/create',
      name: 'mission-editor',
      component: () => import('../views/MissionEditorView.vue'),
      meta: { requiresConnection: true, requiresAuth: true },
    },
    {
      path: '/control',
      name: 'control',
      component: () => import('../views/ControlView.vue'),
      meta: { requiresConnection: true, requiresAuth: true },
    },
    {
      path: '/monitoring',
      name: 'monitoring',
      component: () => import('../views/MonitoringView.vue'),
      meta: { requiresConnection: true, requiresAuth: true },
    },
    {
      path: '/schedule',
      name: 'schedule',
      component: () => import('../views/ScheduleView.vue'),
      meta: { requiresConnection: true, requiresAuth: true },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue'),
      meta: { requiresConnection: true, requiresAuth: true },
    },
    {
      path: '/parameters',
      name: 'parameters',
      component: () => import('../views/ParametersView.vue'),
      meta: { requiresConnection: true, requiresAuth: true },
    },
    {
      path: '/logs',
      name: 'logs',
      component: () => import('../views/LogsView.vue'),
      meta: { requiresConnection: true, requiresAuth: true },
    },
    {
      path: '/battery',
      name: 'battery',
      component: () => import('../views/BatteryView.vue'),
      meta: { requiresConnection: true, requiresAuth: true },
    },
    {
      path: '/weather',
      name: 'weather',
      component: () => import('../views/WeatherView.vue'),
      meta: { requiresConnection: true, requiresAuth: true },
    },
    {
      path: '/calibration',
      name: 'calibration',
      component: () => import('../views/CalibrationView.vue'),
      meta: { requiresConnection: true, requiresAuth: true },
    },
    {
      path: '/rtcm',
      name: 'rtcm',
      component: () => import('../views/RTCMView.vue'),
      meta: { requiresConnection: true, requiresAuth: true },
    },
  ],
})

// Global navigation guard for authentication
router.beforeEach(authGuard)

export default router

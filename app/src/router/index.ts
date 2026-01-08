import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('../views/DashboardView.vue'),
    },
    {
      path: '/attachments',
      name: 'attachments',
      component: () => import('../views/AttachmentsView.vue'),
    },
    {
      path: '/zones',
      name: 'zones',
      component: () => import('../views/ZonesView.vue'),
    },
    {
      path: '/zones/edit/:id?',
      name: 'zone-editor',
      component: () => import('../views/ZoneEditorView.vue'),
    },
    {
      path: '/missions',
      name: 'missions',
      component: () => import('../views/MissionsView.vue'),
    },
    {
      path: '/missions/create',
      name: 'mission-editor',
      component: () => import('../views/MissionEditorView.vue'),
    },
    {
      path: '/control',
      name: 'control',
      component: () => import('../views/ControlView.vue'),
    },
    {
      path: '/monitoring',
      name: 'monitoring',
      component: () => import('../views/MonitoringView.vue'),
    },
    {
      path: '/schedule',
      name: 'schedule',
      component: () => import('../views/ScheduleView.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue'),
    },
    {
      path: '/parameters',
      name: 'parameters',
      component: () => import('../views/ParametersView.vue'),
    },
    {
      path: '/logs',
      name: 'logs',
      component: () => import('../views/LogsView.vue'),
    },
    {
      path: '/battery',
      name: 'battery',
      component: () => import('../views/BatteryView.vue'),
    },
    {
      path: '/weather',
      name: 'weather',
      component: () => import('../views/WeatherView.vue'),
    },
    {
      path: '/connect',
      name: 'connect',
      component: () => import('../views/ConnectionView.vue'),
    },
    {
      path: '/calibration',
      name: 'calibration',
      component: () => import('../views/CalibrationView.vue'),
    },
    {
      path: '/rtcm',
      name: 'rtcm',
      component: () => import('../views/RTCMView.vue'),
    },
  ],
})

export default router

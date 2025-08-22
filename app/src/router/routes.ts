import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/connect',
    name: 'connect',
    component: () => import('pages/ConnectionPage.vue'),
    meta: { title: 'Connect' }
  },
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      {
        path: '',
        name: 'dashboard',
        component: () => import('pages/DashboardPage.vue'),
        meta: { title: 'Dashboard' }
      },
      {
        path: 'control',
        name: 'control',
        component: () => import('pages/ControlPage.vue'),
        meta: { title: 'Control' }
      },
      {
        path: 'missions',
        name: 'missions',
        component: () => import('pages/MissionsPage.vue'),
        meta: { title: 'Missions' }
      },
      {
        path: 'tasks',
        name: 'tasks',
        component: () => import('pages/TasksPage.vue'),
        meta: { title: 'Tasks' }
      },
      {
        path: 'parameters',
        name: 'parameters',
        component: () => import('pages/ParametersPage.vue'),
        meta: { title: 'Parameters' }
      },
      {
        path: 'network',
        name: 'network',
        component: () => import('pages/NetworkPage.vue'),
        meta: { title: 'Network' }
      },
      {
        path: 'health',
        name: 'health',
        component: () => import('pages/HealthPage.vue'),
        meta: { title: 'Health' }
      },
      {
        path: 'rtcm',
        name: 'rtcm',
        component: () => import('pages/RTCMPage.vue'),
        meta: { title: 'RTCM' }
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('pages/SettingsPage.vue'),
        meta: { title: 'Settings' }
      }
    ]
  },
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue')
  }
]

export default routes

import { RouteRecordRaw } from 'vue-router';

export interface RouteMeta {
  title?: string;
  requiresAuth?: boolean;
  requiresConnection?: boolean;
  icon?: string;
  transition?: string;
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: '/dashboard'
      },
      {
        path: '/dashboard',
        name: 'dashboard',
        component: () => import('@/pages/IndexPage.vue'),
        meta: { 
          title: 'Dashboard', 
          icon: 'dashboard',
          requiresAuth: true 
        }
      },
      {
        path: '/connection',
        name: 'connection',
        component: () => import('@/pages/ConnectionPage.vue'),
        meta: { 
          title: 'Connection', 
          icon: 'wifi',
          requiresAuth: true 
        }
      },
      {
        path: '/control',
        name: 'control',
        component: () => import('@/pages/ControlPage.vue'),
        meta: { 
          title: 'Machine Control',
          icon: 'control_camera',
          requiresAuth: true,
          requiresConnection: true 
        }
      },
      {
        path: '/yard',
        name: 'yard',
        component: () => import('@/pages/YardMapPage.vue'),
        meta: { 
          title: 'Yard Map',
          icon: 'map',
          requiresAuth: true 
        }
      },
      {
        path: '/missions',
        name: 'missions',
        component: () => import('@/pages/MissionsPage.vue'),
        meta: { 
          title: 'Missions',
          icon: 'route',
          requiresAuth: true,
          requiresConnection: true 
        }
      },
      {
        path: '/tasks',
        name: 'tasks',
        component: () => import('@/pages/TasksPage.vue'),
        meta: { 
          title: 'Tasks',
          icon: 'assignment',
          requiresAuth: true 
        },
        children: [
          {
            path: '',
            redirect: 'active'
          },
          {
            path: 'active',
            name: 'tasks-active',
            component: () => import('@/pages/tasks/ActiveTasks.vue'),
            meta: { title: 'Active Tasks' }
          },
          {
            path: 'schedule',
            name: 'tasks-schedule',
            component: () => import('@/pages/tasks/Schedule.vue'),
            meta: { title: 'Task Schedule' }
          },
          {
            path: 'history',
            name: 'tasks-history',
            component: () => import('@/pages/tasks/History.vue'),
            meta: { title: 'Task History' }
          }
        ]
      },
      {
        path: '/parameters',
        name: 'parameters',
        component: () => import('@/pages/ParametersPage.vue'),
        meta: { 
          title: 'Parameters',
          icon: 'tune',
          requiresAuth: true,
          requiresConnection: true 
        }
      },
      {
        path: '/rtcm',
        name: 'rtcm',
        component: () => import('@/pages/RTCMPage.vue'),
        meta: { 
          title: 'RTCM',
          icon: 'satellite',
          requiresAuth: true,
          requiresConnection: true 
        }
      },
      {
        path: '/network',
        name: 'network',
        component: () => import('@/pages/NetworkPage.vue'),
        meta: { 
          title: 'Network',
          icon: 'wifi',
          requiresAuth: true,
          requiresConnection: true 
        }
      },
      {
        path: '/health',
        name: 'health',
        component: () => import('@/pages/HealthPage.vue'),
        meta: { 
          title: 'Health Monitor',
          icon: 'monitor_heart',
          requiresAuth: true,
          requiresConnection: true 
        }
      },
      {
        path: '/settings',
        name: 'settings',
        component: () => import('@/pages/SettingsPage.vue'),
        meta: { 
          title: 'Settings',
          icon: 'settings',
          requiresAuth: true 
        }
      }
    ]
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/LoginPage.vue'),
    meta: { 
      title: 'Login',
      requiresAuth: false 
    }
  },
  {
    path: '/:catchAll(.*)*',
    component: () => import('@/pages/ErrorNotFound.vue'),
    meta: { title: '404 - Not Found' }
  }
];

export default routes;
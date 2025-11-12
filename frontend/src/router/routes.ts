import type { RouteRecordRaw } from 'vue-router'

export const routes: RouteRecordRaw[] = [
    {
        path: '/',
        redirect: '/dashboard'
    },
    {
        path: '/dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: {
            requiresAuth: true,
            icon: 'dashboard',
            title: 'Dashboard'
        }
    },
    {
        path: '/machines',
        name: 'MachineControl',
        component: () => import('@/views/MachineControl.vue'),
        meta: {
            requiresAuth: true,
            icon: 'precision_manufacturing',
            title: 'Machines'
        }
    },
    {
        path: '/tasks',
        name: 'Tasks',
        component: () => import('@/views/Tasks.vue'),
        meta: {
            requiresAuth: true,
            icon: 'assignment',
            title: 'Tasks'
        }
    },
    {
        path: '/yard',
        name: 'YardMap',
        component: () => import('@/views/YardMap.vue'),
        meta: {
            requiresAuth: true,
            icon: 'map',
            title: 'Yard Management'
        }
    },
    {
        path: '/api-demo',
        name: 'ApiDemo',
        component: () => import('@/views/ApiDemo.vue'),
        meta: {
            requiresAuth: false,
            icon: 'api',
            title: 'API Demo'
        }
    },
    {
        path: '/settings',
        name: 'Settings',
        component: () => import('@/views/Settings.vue'),
        meta: {
            requiresAuth: true,
            icon: 'settings',
            title: 'Settings'
        }
    }
]

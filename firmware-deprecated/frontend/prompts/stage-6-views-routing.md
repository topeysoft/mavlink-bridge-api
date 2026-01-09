# Stage 6: Views and Routing Configuration

## Objective

Create the main application views and configure Vue Router for navigation between different sections of the YardRover control interface.

## Tasks

1. Set up Vue Router with TypeScript
2. Create main dashboard view
3. Build machine control view
4. Develop task management view
5. Create yard mapping view
6. Build settings and preferences view
7. Implement route guards for authentication
8. Set up lazy loading for routes
9. Create transition animations between views
10. Implement breadcrumb navigation

## Route Structure

```typescript
const routes = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: { requiresAuth: true, icon: 'dashboard' }
  },
  {
    path: '/control',
    name: 'MachineControl',
    component: () => import('@/views/MachineControl.vue'),
    meta: { requiresAuth: true, icon: 'control_camera' }
  },
  {
    path: '/tasks',
    name: 'Tasks',
    component: () => import('@/views/Tasks.vue'),
    meta: { requiresAuth: true, icon: 'assignment' },
    children: [
      {
        path: 'schedule',
        name: 'TaskSchedule',
        component: () => import('@/views/tasks/Schedule.vue')
      },
      {
        path: 'history',
        name: 'TaskHistory',
        component: () => import('@/views/tasks/History.vue')
      }
    ]
  },
  {
    path: '/yard',
    name: 'YardMap',
    component: () => import('@/views/YardMap.vue'),
    meta: { requiresAuth: true, icon: 'map' }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/views/Settings.vue'),
    meta: { requiresAuth: true, icon: 'settings' }
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresAuth: false }
  }
]
```

## Main Views

### Dashboard.vue
```vue
<template>
  <q-page class="dashboard-page">
    <div class="row q-pa-md q-col-gutter-md">
      <!-- Machine Status Card -->
      <div class="col-12 col-md-6">
        <MachineStatusCard />
      </div>
      
      <!-- Weather Widget -->
      <div class="col-12 col-md-6">
        <WeatherCard />
      </div>
      
      <!-- Quick Actions -->
      <div class="col-12">
        <QuickActionsPanel />
      </div>
      
      <!-- Recent Activity -->
      <div class="col-12 col-md-8">
        <RecentActivityCard />
      </div>
      
      <!-- System Health -->
      <div class="col-12 col-md-4">
        <SystemHealthCard />
      </div>
    </div>
  </q-page>
</template>
```

### MachineControl.vue
```vue
<template>
  <q-page class="control-page nature-gradient">
    <q-toolbar class="bg-transparent">
      <q-toolbar-title>Machine Control Center</q-toolbar-title>
    </q-toolbar>
    
    <div class="control-layout">
      <!-- Control Panel -->
      <section class="control-section">
        <MachineControl />
      </section>
      
      <!-- Live Status -->
      <section class="status-section">
        <MachineStatus />
        <BatteryIndicator class="q-mt-md" />
      </section>
      
      <!-- Map View -->
      <section class="map-section">
        <YardMapMini />
      </section>
    </div>
  </q-page>
</template>
```

### YardMap.vue
```vue
<template>
  <q-page class="yard-map-page">
    <q-toolbar class="bg-grass-green text-white">
      <q-toolbar-title>Yard Map & Zones</q-toolbar-title>
      <q-btn flat icon="edit" @click="toggleEditMode">
        {{ editMode ? 'Save' : 'Edit' }}
      </q-btn>
    </q-toolbar>
    
    <div class="map-container">
      <YardMapEditor
        v-model:zones="zones"
        v-model:obstacles="obstacles"
        :edit-mode="editMode"
        @zone-selected="handleZoneSelection"
      />
      
      <q-drawer
        v-model="showZoneDetails"
        side="right"
        :width="350"
        bordered
      >
        <ZoneDetailsPanel
          :zone="selectedZone"
          @update="updateZone"
          @delete="deleteZone"
        />
      </q-drawer>
    </div>
  </q-page>
</template>
```

## Route Guards

```typescript
router.beforeEach(async (to, from) => {
  const userStore = useUserStore()
  
  // Check authentication
  if (to.meta.requiresAuth && !userStore.isAuthenticated) {
    return { name: 'Login', query: { redirect: to.fullPath } }
  }
  
  // Check permissions
  if (to.meta.requiredPermission) {
    const hasPermission = await userStore.checkPermission(to.meta.requiredPermission)
    if (!hasPermission) {
      return { name: 'Dashboard' }
    }
  }
})
```

## Expected Output

A complete routing system with well-organized views, authentication guards, and smooth transitions between different sections of the application.

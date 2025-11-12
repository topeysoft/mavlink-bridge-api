# Stage 8: Cross-Platform Mobile and Desktop Development

## Objective

Configure and optimize the application for cross-platform deployment using Capacitor for mobile (iOS/Android) and Electron for desktop (Windows/macOS/Linux).

## Tasks

1. Configure Capacitor for mobile builds
2. Set up Electron for desktop builds
3. Implement platform-specific features
4. Create responsive layouts for different screen sizes
5. Configure native permissions (GPS, notifications)
6. Implement offline capabilities
7. Set up app icons and splash screens
8. Configure deep linking
9. Implement background tasks for mobile
10. Set up auto-update for desktop

## Mobile Configuration (Capacitor)

### capacitor.config.ts
```typescript
import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.yardrover.app',
  appName: 'YardRover',
  webDir: 'dist',
  bundledWebRuntime: false,
  
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#4CAF50',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false
    },
    
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    
    Geolocation: {
      permissions: {
        location: 'always'
      }
    },
    
    BackgroundRunner: {
      label: 'com.yardrover.app.bgrunner',
      src: 'background.js',
      event: 'machineStatus',
      repeat: true,
      interval: 60 // seconds
    }
  }
}

export default config
```

### Mobile-Specific Features
```typescript
// src/utils/platform.ts
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { Network } from '@capacitor/network'
import { Geolocation } from '@capacitor/geolocation'
import { LocalNotifications } from '@capacitor/local-notifications'

export const Platform = {
  isNative: Capacitor.isNativePlatform(),
  isIOS: Capacitor.getPlatform() === 'ios',
  isAndroid: Capacitor.getPlatform() === 'android',
  isWeb: Capacitor.getPlatform() === 'web'
}

// Background location tracking for mobile
export async function startLocationTracking() {
  if (!Platform.isNative) return
  
  const permission = await Geolocation.checkPermissions()
  if (permission.location !== 'granted') {
    await Geolocation.requestPermissions()
  }
  
  // Watch position with background updates
  const watchId = await Geolocation.watchPosition(
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      requireAltitude: false
    },
    (position) => {
      // Send location to server
      MachineService.updateLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude
      })
    }
  )
  
  return watchId
}

// Push notifications for task completion
export async function setupNotifications() {
  if (!Platform.isNative) return
  
  await LocalNotifications.requestPermissions()
  
  // Schedule notification for task completion
  await LocalNotifications.schedule({
    notifications: [
      {
        title: 'Task Completed',
        body: 'Your mowing task has been completed successfully',
        id: 1,
        sound: 'beep.wav',
        attachments: null,
        actionTypeId: '',
        extra: null
      }
    ]
  })
}
```

## Desktop Configuration (Electron)

### electron/main.ts
```typescript
import { app, BrowserWindow, Menu, Tray, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import path from 'path'

let mainWindow: BrowserWindow | null
let tray: Tray | null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    
    frame: process.platform !== 'darwin',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#4CAF50',
    
    icon: path.join(__dirname, '../assets/icon.png')
  })
  
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
  
  // Create tray icon
  createTray()
  
  // Auto updater
  autoUpdater.checkForUpdatesAndNotify()
}

function createTray() {
  tray = new Tray(path.join(__dirname, '../assets/tray-icon.png'))
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show YardRover',
      click: () => mainWindow?.show()
    },
    {
      label: 'Start Machine',
      click: () => mainWindow?.webContents.send('start-machine')
    },
    {
      label: 'Stop Machine',
      click: () => mainWindow?.webContents.send('stop-machine')
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit()
    }
  ])
  
  tray.setToolTip('YardRover Control')
  tray.setContextMenu(contextMenu)
}

// IPC handlers for native features
ipcMain.handle('get-location', async () => {
  // Use system location services
  return { lat: 0, lng: 0 } // Implement actual location
})

ipcMain.handle('save-file', async (event, data) => {
  // Save configuration file
  const { filePath } = await dialog.showSaveDialog({
    defaultPath: 'yard-config.json',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  
  if (filePath) {
    await fs.writeFile(filePath, data)
    return { success: true, path: filePath }
  }
})

app.whenReady().then(createWindow)
```

### Responsive Layouts
```vue
<!-- src/layouts/MainLayout.vue -->
<template>
  <q-layout view="hHh lpR fFf">
    <!-- Desktop Header -->
    <q-header v-if="!$q.platform.is.mobile" elevated>
      <q-toolbar class="bg-grass-green">
        <q-btn flat dense round icon="menu" @click="toggleLeftDrawer" />
        <q-toolbar-title>YardRover Control</q-toolbar-title>
        <ConnectionStatus />
        <WeatherWidget v-if="$q.screen.gt.md" />
      </q-toolbar>
    </q-header>
    
    <!-- Mobile Bottom Navigation -->
    <q-footer v-if="$q.platform.is.mobile" elevated>
      <q-tabs
        v-model="tab"
        class="bg-grass-green text-white"
        active-color="white"
        indicator-color="white"
        align="justify"
      >
        <q-tab name="dashboard" icon="dashboard" label="Home" />
        <q-tab name="control" icon="control_camera" label="Control" />
        <q-tab name="tasks" icon="assignment" label="Tasks" />
        <q-tab name="map" icon="map" label="Map" />
        <q-tab name="settings" icon="settings" label="More" />
      </q-tabs>
    </q-footer>
    
    <!-- Side Drawer (Desktop) -->
    <q-drawer
      v-if="!$q.platform.is.mobile"
      v-model="leftDrawerOpen"
      show-if-above
      bordered
      :width="250"
    >
      <SideNavigation />
    </q-drawer>
    
    <!-- Page Container -->
    <q-page-container>
      <router-view v-slot="{ Component }">
        <transition
          :name="$q.platform.is.mobile ? 'slide' : 'fade'"
          mode="out-in"
        >
          <component :is="Component" />
        </transition>
      </router-view>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import ConnectionStatus from '@/components/ConnectionStatus.vue'
import WeatherWidget from '@/components/WeatherWidget.vue'
import SideNavigation from '@/components/SideNavigation.vue'

const $q = useQuasar()
const router = useRouter()

const leftDrawerOpen = ref(false)
const tab = ref('dashboard')

// Sync tab with route
watch(tab, (newTab) => {
  router.push(`/${newTab}`)
})

// Handle platform-specific features
if ($q.platform.is.capacitor) {
  // Mobile-specific setup
  setupMobileFeatures()
} else if ($q.platform.is.electron) {
  // Desktop-specific setup
  setupDesktopFeatures()
}
</script>
```

## Platform-Specific Builds

### package.json scripts
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:ios": "npm run build && cap sync ios && cap open ios",
    "build:android": "npm run build && cap sync android && cap open android",
    "build:electron": "npm run build && electron-builder",
    "electron": "electron .",
    "electron:dev": "concurrently \"npm run dev\" \"wait-on http://localhost:3000 && electron .\"",
    "dist:win": "npm run build && electron-builder --win",
    "dist:mac": "npm run build && electron-builder --mac",
    "dist:linux": "npm run build && electron-builder --linux"
  }
}
```

## Expected Output

A fully configured cross-platform application that runs seamlessly on iOS, Android, Windows, macOS, and Linux with platform-specific optimizations and native features.

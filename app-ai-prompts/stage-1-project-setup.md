# Stage 1: Project Setup & Core Infrastructure
> **Status**: ✅ Complete | **Updated**: 2025-09-02

## Objective
Set up a new Quasar 2 project with Vue 3, TypeScript, SCSS, and Pinia. Configure the project for cross-platform development with Electron and Capacitor. Establish the core infrastructure including routing, state management, design system, and API integration layer.

## Requirements

### Technology Stack
- Quasar 2.x (latest)
- Vue 3 with Composition API (`<script setup>`)
- TypeScript 5.x
- SCSS for styling
- Pinia for state management
- Electron for desktop apps
- Capacitor for mobile apps
- Vite as build tool

### Project Initialization

Create a new Quasar project with the following configuration:

```bash
npm create quasar@latest
# or
yarn create quasar
```

Select these options:
- Project name: `yardrover-app`
- Project product name: YardRover Control
- Project description: Control and monitor your autonomous yard utility machine
- Author: [your details]
- CSS preprocessor: SCSS
- Features:
  - ESLint
  - TypeScript
  - Vue Router
  - Pinia
  - Axios (for HTTP client)
- ESLint preset: Prettier
- Install project dependencies: Yes

### Post-Installation Setup

1. Install additional dependencies:
```bash
cd yardrover-app
npm install --save \
  @mavlinkbridge/api-client \
  leaflet @types/leaflet \
  date-fns \
  lodash-es @types/lodash-es \
  chart.js vue-chartjs \
  @vueuse/core

npm install --save-dev \
  @types/node \
  sass \
  @quasar/quasar-app-extension-testing-unit-vitest
```

2. Add Electron support:
```bash
quasar mode add electron
```

3. Add Capacitor support:
```bash
quasar mode add capacitor
```

### Project Structure

Create the following directory structure:

```
src/
├── assets/
│   ├── styles/
│   │   ├── _variables.scss      # SCSS variables
│   │   ├── _mixins.scss         # SCSS mixins
│   │   ├── _animations.scss     # Animations
│   │   ├── _utilities.scss      # Utility classes
│   │   └── main.scss            # Main stylesheet
│   └── images/
│       └── nature/              # Nature-themed images
├── components/
│   └── common/                  # Common components
│       ├── AppLogo.vue
│       ├── ConnectionIndicator.vue
│       └── LoadingSpinner.vue
├── composables/
│   ├── useConnection.ts         # Connection management
│   ├── useNotification.ts       # Notifications
│   └── useTheme.ts              # Theme management
├── layouts/
│   └── MainLayout.vue           # Main app layout
├── pages/
│   ├── IndexPage.vue            # Dashboard
│   └── ErrorNotFound.vue        # 404 page
├── router/
│   ├── index.ts
│   └── routes.ts
├── services/
│   ├── api/
│   │   ├── client.ts            # API client wrapper
│   │   └── types.ts             # API types
│   └── storage/
│       └── localStorage.ts      # Local storage utilities
├── stores/
│   ├── app.ts                   # App-level state
│   ├── connection.ts            # Connection state
│   └── user-preferences.ts      # User preferences
├── utils/
│   ├── constants.ts             # App constants
│   ├── formatters.ts            # Data formatters
│   └── validators.ts            # Input validators
└── App.vue
```

### Design System Implementation

#### Color Variables (_variables.scss)
```scss
// Nature-inspired color palette
$primary: #2C5F2D;          // Forest Green
$secondary: #87CEEB;        // Sky Blue
$accent: #FF6B35;           // Sunset Orange
$positive: #21BA45;         // Success Green
$negative: #C10015;         // Error Red
$info: #31CCEC;            // Info Blue
$warning: #F2C037;          // Warning Yellow

// Background colors
$background: #F5F5DC;       // Soft Beige
$surface: #FFFFFF;          // White
$surface-variant: #F8F8F3;  // Light Beige

// Text colors
$text-primary: #3E2723;     // Dark Earth
$text-secondary: #5D4E37;   // Medium Brown
$text-disabled: #A89F91;    // Light Brown

// Spacing
$spacing-xs: 4px;
$spacing-sm: 8px;
$spacing-md: 16px;
$spacing-lg: 24px;
$spacing-xl: 32px;

// Border radius
$radius-sm: 4px;
$radius-md: 8px;
$radius-lg: 16px;
$radius-round: 9999px;

// Shadows
$shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.1);
$shadow-md: 0 4px 8px rgba(0, 0, 0, 0.1);
$shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.1);

// Transitions
$transition-fast: 150ms ease-in-out;
$transition-normal: 300ms ease-in-out;
$transition-slow: 500ms ease-in-out;
```

### Quasar Configuration (quasar.config.ts)

Configure Quasar with the nature theme:

```typescript
import { configure } from 'quasar/wrappers';

export default configure((ctx) => {
  return {
    // ... other config
    
    framework: {
      config: {
        brand: {
          primary: '#2C5F2D',
          secondary: '#87CEEB',
          accent: '#FF6B35',
          positive: '#21BA45',
          negative: '#C10015',
          info: '#31CCEC',
          warning: '#F2C037',
          dark: '#3E2723',
          'dark-page': '#2C2C2C'
        },
        notify: {
          position: 'top-right',
          timeout: 3000,
          textColor: 'white',
          actions: [{ icon: 'close', color: 'white' }]
        },
        loading: {
          delay: 400,
          message: 'Loading...',
          spinnerSize: 60,
          spinnerColor: 'primary'
        }
      },
      
      plugins: [
        'Notify',
        'Loading',
        'Dialog',
        'LoadingBar',
        'LocalStorage',
        'SessionStorage'
      ],
      
      iconSet: 'material-icons',
      
      components: [
        // Auto-import all Quasar components
      ],
      
      directives: [
        'Ripple',
        'ClosePopup',
        'TouchSwipe'
      ]
    },
    
    build: {
      vueRouterMode: 'history',
      
      env: {
        API_URL: ctx.dev 
          ? 'http://192.168.4.1'
          : process.env.API_URL || 'http://yardrover.local'
      },
      
      extendViteConf(viteConf) {
        viteConf.resolve.alias = {
          ...viteConf.resolve.alias,
          '@': '/src'
        };
      }
    },
    
    devServer: {
      open: true,
      port: 9000
    }
  };
});
```

### API Client Service (services/api/client.ts)

Create a wrapper around the MAVLinkBridge client:

```typescript
import { MAVLinkBridgeClient } from '@mavlinkbridge/api-client';
import { useConnectionStore } from '@/stores/connection';
import { Notify } from 'quasar';

class ApiClient {
  private client: MAVLinkBridgeClient | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  
  async connect(url: string): Promise<void> {
    try {
      this.disconnect();
      
      this.client = new MAVLinkBridgeClient(url, {
        autoReconnect: true,
        reconnectDelay: 1000,
        maxReconnectAttempts: 5
      });
      
      await this.client.connect();
      
      // Set up event handlers
      this.setupEventHandlers();
      
      // Update connection store
      const connectionStore = useConnectionStore();
      connectionStore.setConnected(true, url);
      
      Notify.create({
        type: 'positive',
        message: 'Connected to YardRover'
      });
    } catch (error) {
      Notify.create({
        type: 'negative',
        message: `Connection failed: ${error.message}`
      });
      throw error;
    }
  }
  
  disconnect(): void {
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    const connectionStore = useConnectionStore();
    connectionStore.setConnected(false);
  }
  
  getClient(): MAVLinkBridgeClient {
    if (!this.client) {
      throw new Error('Not connected to device');
    }
    return this.client;
  }
  
  private setupEventHandlers(): void {
    if (!this.client) return;
    
    this.client.on('disconnect', () => {
      const connectionStore = useConnectionStore();
      connectionStore.setConnected(false);
      
      Notify.create({
        type: 'warning',
        message: 'Disconnected from YardRover'
      });
    });
    
    this.client.on('error', (error) => {
      console.error('API Client Error:', error);
      
      Notify.create({
        type: 'negative',
        message: `Error: ${error.message}`
      });
    });
  }
}

export const apiClient = new ApiClient();
```

### Main Layout (layouts/MainLayout.vue)

Create a nature-themed layout with navigation:

```vue
<template>
  <q-layout view="lHh LpR fFf">
    <!-- Header -->
    <q-header elevated class="bg-primary">
      <q-toolbar>
        <q-btn
          flat
          dense
          round
          icon="menu"
          aria-label="Menu"
          @click="toggleLeftDrawer"
        />
        
        <q-toolbar-title class="flex items-center">
          <AppLogo class="q-mr-sm" />
          <span>YardRover Control</span>
        </q-toolbar-title>
        
        <ConnectionIndicator />
      </q-toolbar>
    </q-header>
    
    <!-- Left Drawer -->
    <q-drawer
      v-model="leftDrawerOpen"
      show-if-above
      bordered
      :width="250"
      :breakpoint="600"
    >
      <q-list>
        <q-item-label header class="text-primary">
          Navigation
        </q-item-label>
        
        <NavItem
          v-for="item in navigationItems"
          :key="item.path"
          v-bind="item"
        />
      </q-list>
    </q-drawer>
    
    <!-- Page Container -->
    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import AppLogo from '@/components/common/AppLogo.vue';
import ConnectionIndicator from '@/components/common/ConnectionIndicator.vue';
import NavItem from '@/components/layout/NavItem.vue';

const leftDrawerOpen = ref(false);

const navigationItems = [
  {
    title: 'Dashboard',
    icon: 'dashboard',
    path: '/',
    color: 'primary'
  },
  {
    title: 'Control',
    icon: 'control_camera',
    path: '/control',
    color: 'accent'
  },
  {
    title: 'Missions',
    icon: 'map',
    path: '/missions',
    color: 'secondary'
  },
  {
    title: 'Tasks',
    icon: 'task_alt',
    path: '/tasks',
    color: 'positive'
  },
  {
    title: 'Settings',
    icon: 'settings',
    path: '/settings',
    color: 'grey-7'
  }
];

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value;
}
</script>

<style lang="scss">
.q-header {
  background: linear-gradient(135deg, $primary 0%, darken($primary, 10%) 100%);
}
</style>
```

### Store Setup (stores/app.ts)

Create the main app store with Pinia:

```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useAppStore = defineStore('app', () => {
  // State
  const isLoading = ref(false);
  const isDarkMode = ref(false);
  const sidebarOpen = ref(true);
  const currentTheme = ref<'summer' | 'autumn' | 'winter' | 'spring'>('summer');
  
  // Getters
  const themeClass = computed(() => `theme-${currentTheme.value}`);
  
  // Actions
  function setLoading(loading: boolean) {
    isLoading.value = loading;
  }
  
  function toggleDarkMode() {
    isDarkMode.value = !isDarkMode.value;
    // Apply dark mode to Quasar
    document.body.classList.toggle('body--dark', isDarkMode.value);
  }
  
  function setTheme(theme: typeof currentTheme.value) {
    currentTheme.value = theme;
  }
  
  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value;
  }
  
  return {
    // State
    isLoading,
    isDarkMode,
    sidebarOpen,
    currentTheme,
    
    // Getters
    themeClass,
    
    // Actions
    setLoading,
    toggleDarkMode,
    setTheme,
    toggleSidebar
  };
});
```

### Environment Configuration

Create environment files:

1. `.env.development`:
```env
VITE_API_URL=http://192.168.4.1
VITE_WS_URL=ws://192.168.4.1/ws
VITE_APP_VERSION=1.0.0-dev
```

2. `.env.production`:
```env
VITE_API_URL=http://yardrover.local
VITE_WS_URL=ws://yardrover.local/ws
VITE_APP_VERSION=1.0.0
```

### TypeScript Configuration

Update `tsconfig.json`:

```json
{
  "extends": "@quasar/app-vite/tsconfig-preset",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "src/*": ["src/*"],
      "app/*": ["*"],
      "components/*": ["src/components/*"],
      "layouts/*": ["src/layouts/*"],
      "pages/*": ["src/pages/*"],
      "assets/*": ["src/assets/*"],
      "stores/*": ["src/stores/*"],
      "services/*": ["src/services/*"],
      "utils/*": ["src/utils/*"]
    },
    "types": [
      "vite/client",
      "@types/node",
      "@quasar/app-vite"
    ]
  },
  "include": [
    "src/**/*.ts",
    "src/**/*.tsx",
    "src/**/*.vue",
    "src/**/*.json"
  ],
  "exclude": [
    "node_modules",
    "dist",
    ".quasar",
    "src-capacitor",
    "src-electron"
  ]
}
```

### Testing Setup

Install and configure Vitest:

```bash
quasar ext add @quasar/testing-unit-vitest
```

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { quasar, transformAssetUrls } from '@quasar/vite-plugin';
import path from 'path';

export default defineConfig({
  plugins: [
    vue({
      template: { transformAssetUrls }
    }),
    quasar({
      sassVariables: 'src/assets/styles/_variables.scss'
    })
  ],
  test: {
    environment: 'happy-dom',
    globals: true,
    coverage: {
      reporter: ['text', 'json', 'html']
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

## Implementation Checklist

- [ ] Initialize Quasar project with correct options
- [ ] Install all required dependencies
- [ ] Add Electron and Capacitor modes
- [ ] Create directory structure
- [ ] Set up SCSS design system with nature theme
- [ ] Configure Quasar with custom colors and options
- [ ] Create API client service wrapper
- [ ] Implement main layout with navigation
- [ ] Set up Pinia stores
- [ ] Configure environment variables
- [ ] Update TypeScript configuration
- [ ] Set up testing framework
- [ ] Create common components (Logo, ConnectionIndicator, LoadingSpinner)
- [ ] Implement dark mode support
- [ ] Add seasonal theme variations
- [ ] Configure build processes for all platforms

## Next Steps

After completing this stage, proceed to Stage 2: Connection & Device Management to implement device discovery and connection features.
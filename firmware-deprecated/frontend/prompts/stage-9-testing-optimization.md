# Stage 9: Testing and Performance Optimization

## Objective

Implement comprehensive testing strategies and optimize the application for performance, including unit tests, E2E tests, and performance monitoring.

## Tasks

1. Set up Vitest for unit testing
2. Configure Cypress for E2E testing
3. Implement component testing with Vue Test Utils
4. Create test fixtures and mocks
5. Set up code coverage reporting
6. Implement performance monitoring
7. Optimize bundle size
8. Set up lazy loading strategies
9. Implement caching strategies
10. Configure PWA features

## Testing Setup

### Unit Testing Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { quasar, transformAssetUrls } from '@quasar/vite-plugin'

export default defineConfig({
  plugins: [
    vue({ template: { transformAssetUrls } }),
    quasar({ autoImportComponentCase: 'pascal' })
  ],
  test: {
    environment: 'happy-dom',
    globals: true,
    coverage: {
      reporter: ['text', 'lcov', 'html'],
      exclude: ['node_modules/', 'tests/']
    },
    setupFiles: ['./tests/setup.ts']
  }
})
```

### Component Testing Examples

```typescript
// tests/components/MachineControl.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { Quasar } from 'quasar'
import MachineControl from '@/components/machine/MachineControl.vue'
import { useMachineStore } from '@/stores/machine'

describe('MachineControl', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })
  
  it('should render control buttons', () => {
    const wrapper = mount(MachineControl, {
      global: {
        plugins: [Quasar]
      }
    })
    
    expect(wrapper.find('[data-test="start-button"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="stop-button"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="pause-button"]').exists()).toBe(true)
  })
  
  it('should disable start button when battery is low', async () => {
    const store = useMachineStore()
    store.battery = 10 // Low battery
    
    const wrapper = mount(MachineControl, {
      global: {
        plugins: [Quasar]
      }
    })
    
    const startButton = wrapper.find('[data-test="start-button"]')
    expect(startButton.attributes('disabled')).toBeDefined()
  })
  
  it('should call start machine action', async () => {
    const store = useMachineStore()
    const startSpy = vi.spyOn(store, 'startMachine')
    
    const wrapper = mount(MachineControl, {
      global: {
        plugins: [Quasar]
      }
    })
    
    await wrapper.find('[data-test="start-button"]').trigger('click')
    expect(startSpy).toHaveBeenCalled()
  })
})
```

### E2E Testing with Cypress

```typescript
// cypress/e2e/machine-control.cy.ts
describe('Machine Control Flow', () => {
  beforeEach(() => {
    cy.visit('/login')
    cy.login('test@yardrover.com', 'password')
    cy.visit('/control')
  })
  
  it('should complete a full mowing cycle', () => {
    // Check initial state
    cy.get('[data-test="machine-status"]').should('contain', 'Idle')
    cy.get('[data-test="battery-level"]').should('contain', '100%')
    
    // Select mowing mode
    cy.get('[data-test="mode-selector"]').click()
    cy.get('[data-test="mode-mowing"]').click()
    
    // Start machine
    cy.get('[data-test="start-button"]').click()
    cy.get('[data-test="machine-status"]').should('contain', 'Running')
    
    // Monitor progress
    cy.get('[data-test="progress-bar"]', { timeout: 10000 })
      .should('be.visible')
    
    // Pause operation
    cy.get('[data-test="pause-button"]').click()
    cy.get('[data-test="machine-status"]').should('contain', 'Paused')
    
    // Resume and complete
    cy.get('[data-test="resume-button"]').click()
    cy.get('[data-test="machine-status"]').should('contain', 'Running')
    
    // Wait for completion
    cy.get('[data-test="task-complete"]', { timeout: 30000 })
      .should('be.visible')
  })
})
```

## Performance Optimization

### Bundle Optimization

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { quasar } from '@quasar/vite-plugin'
import { visualizer } from 'rollup-plugin-visualizer'
import viteCompression from 'vite-plugin-compression'

export default defineConfig({
  plugins: [
    vue(),
    quasar(),
    visualizer({
      open: true,
      gzipSize: true
    }),
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz'
    })
  ],
  
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['vue', 'pinia', 'vue-router'],
          'quasar': ['quasar'],
          'charts': ['chart.js', 'chartjs-adapter-date-fns'],
          'maps': ['leaflet', '@capacitor/geolocation']
        }
      }
    },
    
    // Enable tree shaking
    treeshake: {
      moduleSideEffects: false
    }
  }
})
```

### Lazy Loading Routes

```typescript
// src/router/routes.ts
const routes = [
  {
    path: '/dashboard',
    component: () => import(
      /* webpackChunkName: "dashboard" */
      '@/views/Dashboard.vue'
    )
  },
  {
    path: '/yard',
    component: () => import(
      /* webpackChunkName: "yard" */
      /* webpackPrefetch: true */
      '@/views/YardMap.vue'
    )
  },
  {
    path: '/tasks',
    component: () => import(
      /* webpackChunkName: "tasks" */
      '@/views/Tasks.vue'
    ),
    children: [
      {
        path: 'history',
        component: () => import(
          /* webpackChunkName: "task-history" */
          '@/views/tasks/History.vue'
        )
      }
    ]
  }
]
```

### Performance Monitoring

```typescript
// src/utils/performance.ts
export class PerformanceMonitor {
  private marks: Map<string, number> = new Map()
  
  mark(name: string) {
    this.marks.set(name, performance.now())
  }
  
  measure(name: string, startMark: string, endMark?: string) {
    const start = this.marks.get(startMark)
    const end = endMark ? this.marks.get(endMark) : performance.now()
    
    if (start && end) {
      const duration = end - start
      
      // Send to analytics
      if (window.gtag) {
        window.gtag('event', 'timing_complete', {
          name,
          value: Math.round(duration)
        })
      }
      
      // Log in development
      if (import.meta.env.DEV) {
        console.log(`Performance: ${name} took ${duration.toFixed(2)}ms`)
      }
      
      return duration
    }
  }
  
  // Monitor component render time
  measureComponent(componentName: string) {
    return {
      onMounted: () => this.mark(`${componentName}-mounted`),
      onUpdated: () => {
        this.measure(
          `${componentName}-update`,
          `${componentName}-mounted`
        )
      }
    }
  }
}

// Usage in components
const perf = new PerformanceMonitor()

export function usePerformance(componentName: string) {
  onMounted(() => perf.mark(`${componentName}-mounted`))
  onUpdated(() => {
    perf.measure(`${componentName}-render`, `${componentName}-mounted`)
  })
}
```

### PWA Configuration

```typescript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'YardRover Control',
        short_name: 'YardRover',
        description: 'Control your autonomous yard machine',
        theme_color: '#4CAF50',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.yardrover\.com\/.*$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 300 // 5 minutes
              }
            }
          },
          {
            urlPattern: /^https:\/\/cdn\.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cdn-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 86400 // 1 day
              }
            }
          }
        ]
      }
    })
  ]
})
```

## Expected Output

A well-tested, performant application with comprehensive test coverage, optimized bundle sizes, and monitoring capabilities for continuous improvement.

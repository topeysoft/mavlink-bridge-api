# YardRover Web App - Development Guide

## ⚠️ CRITICAL: NO QUASAR COMPONENTS

**This app does NOT use Quasar.** All UI must use:
- ✅ Native HTML (`<input>`, `<button>`, `<select>`, `<div>`)
- ✅ Pure Vue 3 with Composition API (`<script setup lang="ts">`)
- ✅ Custom SCSS styling
- ✅ Emoji or SVG icons

**DO NOT USE:**
- ❌ `q-btn`, `q-input`, `q-dialog`, `q-card`, `q-icon`, etc.
- ❌ `useQuasar()` composable
- ❌ Any imports from `'quasar'`

**For common patterns:**
- **Buttons**: `<button class="btn btn-primary">` with custom CSS
- **Inputs**: `<input>` with custom styling
- **Dialogs**: `useDialog()` composable (see below)
- **Icons**: Emoji (🔍, ⚙️, 📊) or inline SVG
- **Notifications**: `useNotifications()` for toasts
- **Forms**: Native HTML with Vue bindings

## File Organization

### Directory Structure

```
app/src/
├── pages/           # Pre-auth standalone pages (hide sidebar/header)
├── views/           # Authenticated app views (show sidebar/header)
├── components/      # Reusable UI components
├── layouts/         # Layout wrapper components
├── stores/          # Pinia stores (composition API)
├── assets/styles/   # SCSS theme system
└── router/          # Vue Router with guards
```

### Naming Conventions

**IMPORTANT**: Follow these strict patterns:

1. **Pages** (`pages/`) - `*Page.vue` (e.g., `ConnectionPage.vue`, `LoginPage.vue`)
   - Pre-authentication or standalone routes
   - Use `StandaloneLayout` wrapper
   - No sidebar/header shown
   - Special route guards

2. **Views** (`views/`) - `*View.vue` (e.g., `DashboardView.vue`, `SettingsView.vue`)
   - Main authenticated app routes
   - Require authentication
   - Show sidebar + header
   - Protected by authGuard

3. **Components** (`components/`) - No suffix (e.g., `TechnicalConnection.vue`, `Header.vue`)
   - Reusable UI pieces
   - No routing logic
   - Imported by pages/views

4. **Layouts** (`layouts/`) - `*Layout.vue` (e.g., `StandaloneLayout.vue`)
   - Wrap entire pages
   - Provide common structure
   - Use `<slot>` for content

### Example Structure

```
pages/
  ConnectionPage.vue    # /connect
  LoginPage.vue         # /login

views/
  DashboardView.vue     # /dashboard (auth required)
  SettingsView.vue      # /settings (auth required)

components/
  connection/
    TechnicalConnection.vue
    ConsumerConnection.vue
  common/
    Header.vue
    Sidebar.vue

layouts/
  StandaloneLayout.vue
```

## Code Conventions

### Vue Components

```vue
<template>
  <div class="my-component">
    <button class="btn btn-primary" @click="handleClick">
      <span class="icon">✓</span>
      Save
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useMyStore } from '@/stores/myStore'

const myStore = useMyStore()
const count = ref(0)

function handleClick() {
  count.value++
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables';

.my-component {
  padding: $spacing-md;
  background: $grey-1;
}

.btn-primary {
  background: $primary;
  color: white;

  &:hover {
    background: darken($primary, 5%);
  }
}
</style>
```

### SCSS Variables

Always import variables for consistency:

```scss
@import '@/assets/styles/variables';

// Available colors
$primary: #2C5F2D;      // Forest green
$secondary: #87CEEB;    // Sky blue
$accent: #7CB342;       // Grass green

$positive: #28a745;
$negative: #dc3545;
$warning: #ffc107;

// Spacing
$spacing-xs: 0.25rem;
$spacing-sm: 0.5rem;
$spacing-md: 1rem;
$spacing-lg: 1.5rem;
$spacing-xl: 2rem;
```

## Dialog System

**ALWAYS use `useDialog()` instead of native browser dialogs:**

```typescript
import { useDialog } from '@/composables/useDialog'

const dialog = useDialog()

// Confirmation dialog
async function handleDelete() {
  const confirmed = await dialog.confirm(
    'Are you sure you want to delete this?',
    'Confirm Delete',
    { variant: 'danger', icon: '⚠️' }
  )

  if (confirmed) {
    // Proceed with deletion
  }
}

// Alert dialog
await dialog.alert('Saved successfully!', 'Success', { variant: 'success' })
```

**Variants**: `default`, `danger`, `warning`, `success`, `info`

**Benefits**:
- Themed UI matching the app
- Promise-based async/await API
- Keyboard shortcuts (Esc, Enter)
- Better mobile support
- Custom icons and styling

## User Modes & Feature Flags

Check feature flags before rendering:

```typescript
import { useFeaturesStore } from '@/stores/features'

const featuresStore = useFeaturesStore()

// Check specific feature
if (featuresStore.isFeatureEnabled('systemMonitoring')) {
  // Show system monitoring
}

// Check user mode
const isConsumerMode = computed(() => featuresStore.userMode === 'consumer')
```

**User Modes:**
- **Consumer**: Basic features, friendly language, emojis
- **Power User**: Advanced features, technical terms
- **Developer**: All features, debug tools

## Common UI Patterns

### Custom Modal

```vue
<template>
  <div v-if="showModal" class="modal-overlay" @click="showModal = false">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h2>Title</h2>
        <button @click="showModal = false" class="close-btn">✕</button>
      </div>
      <div class="modal-body">
        Content
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="showModal = false">Cancel</button>
        <button class="btn btn-primary" @click="handleSave">Save</button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 12px;
  max-width: 500px;
  width: 100%;
}
</style>
```

### Dropdown Menu

```vue
<template>
  <div class="dropdown">
    <button @click="toggle" class="dropdown-trigger">Menu ⋮</button>
    <div v-if="isOpen" class="dropdown-menu">
      <button @click="handleAction">Action</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const isOpen = ref(false)

function toggle() {
  isOpen.value = !isOpen.value
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('.dropdown')) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>
```

## Development Commands

```bash
# Start dev server
npm run dev

# Type check
npm run type-check

# Build
npm run build

# Preview production build
npm run preview
```

## Client Library Integration

**ALWAYS use the client library for device communication:**

```typescript
import { MAVLinkBridge } from '../../../client/dist/index'

const client = new MAVLinkBridge(deviceUrl)

// Get status
const status = await client.getStatus()

// Login
await client.authClient.login('yr_api_key')

// WebSocket
client.connectWebSocket()
client.on('telemetry', (data) => {
  console.log('Telemetry:', data)
})
```

**Never make direct fetch calls** to device endpoints.

## Best Practices

1. **No Quasar** - Use custom components only
2. **Type Safety** - Use TypeScript with strict mode
3. **SCSS Variables** - Import centralized theme variables
4. **Composition API** - Use `<script setup>` for all components
5. **Feature Flags** - Check before showing advanced features
6. **Dialog System** - Use `useDialog()` instead of native dialogs
7. **Emoji Icons** - Prefer emoji for simple icons (faster, no deps)
8. **Accessibility** - Use semantic HTML and ARIA labels
9. **Responsive** - Test on mobile viewports
10. **Client Library** - Use for all device API calls

## Key Files Reference

- **Dialog system**: `src/composables/useDialog.ts`
- **Feature flags**: `src/stores/features.ts`
- **Auth store**: `src/stores/auth.ts`
- **Connection store**: `src/stores/connection.ts`
- **Theme variables**: `src/assets/styles/_variables.scss`
- **Layout**: `src/layouts/StandaloneLayout.vue`
- **Router guards**: `src/router/guards.ts`

## Examples

- **Dialogs**: See any view/component using `useDialog()`
- **Modals**: See `src/components/common/Modal.vue`
- **Forms**: See `src/views/ParametersView.vue`
- **Charts**: See `src/components/logs/LogCharts.vue`
- **Mode-specific components**: See `src/components/connection/ConsumerConnection.vue`

## Common Issues

- **SCSS Issues**: Import variables with `@import '@/assets/styles/variables';`
- **Client Types**: Use `../../../client/dist/index` for imports
- **Build Errors**: Rebuild client library: `cd ../client && npm run build`

# YardRover Web App - Development Guide

## ⚠️ CRITICAL: NO QUASAR COMPONENTS

**This app does NOT use Quasar components.** All UI components must be implemented using:
- ✅ Native HTML elements (`<input>`, `<button>`, `<select>`, `<div>`, etc.)
- ✅ Pure Vue 3 with Composition API (`<script setup lang="ts">`)
- ✅ Custom CSS/SCSS styling
- ✅ Emoji icons or SVG icons (NO Material Icons from Quasar)

**DO NOT USE:**
- ❌ `q-btn`, `q-input`, `q-select`, `q-dialog`, `q-card`, `q-icon`, `q-list`, `q-item`, `q-page`, etc.
- ❌ `useQuasar()` composable
- ❌ Any imports from `'quasar'`

**For common UI patterns:**
- **Buttons**: Use `<button class="btn btn-primary">` with custom CSS
- **Inputs**: Use `<input>` with custom styling
- **Dialogs/Modals**: Use `useDialog()` composable (see Dialog System section)
- **Icons**: Use emoji (🔍, ⚙️, 📊) or inline SVG
- **Notifications**: Use `useNotifications()` composable for toast messages
- **Forms**: Use native HTML form elements with Vue bindings

## Technology Stack

- **Framework**: Vue 3 with Composition API
- **Language**: TypeScript (strict mode)
- **State Management**: Pinia stores
- **Styling**: SCSS with custom variables
- **Build Tool**: Vite
- **Charts**: Chart.js + vue-chartjs

## Project Structure

```
app/src/
├── pages/                   # Standalone route pages (pre-auth, public)
│   ├── ConnectionPage.vue  # Device connection page
│   ├── LoginPage.vue        # Login/authentication page
│   └── SetupPage.vue        # First-time setup wizard
├── views/                   # Main app route views (authenticated)
│   ├── DashboardView.vue
│   ├── SettingsView.vue
│   └── [feature]View.vue
├── layouts/                 # Reusable layout components
│   └── StandaloneLayout.vue # Layout for pages/ (logo + theme toggle)
├── components/
│   ├── [feature]/           # Feature-based organization
│   └── common/              # Shared components
├── stores/                  # Pinia stores (composition API)
├── types/                   # TypeScript type definitions
├── assets/
│   └── styles/
│       ├── variables.scss   # Color palette & design tokens
│       ├── mixins.scss      # Reusable SCSS mixins
│       └── index.scss       # Global styles
└── router/                  # Vue Router configuration
```

## File Organization Patterns

### Naming Conventions

**IMPORTANT**: Follow these strict naming patterns to maintain consistency:

1. **Pages (`pages/`)** - Standalone route pages (pre-authentication/public)
   - Naming: `*Page.vue` (e.g., `ConnectionPage.vue`, `LoginPage.vue`, `SetupPage.vue`)
   - Purpose: Entry points for unauthenticated or standalone flows
   - Characteristics:
     - Use `StandaloneLayout` wrapper
     - Hide sidebar/header via App.vue logic
     - Have route guards (connectionGuard, loginGuard, setupGuard)
     - Redirect authenticated users away

2. **Views (`views/`)** - Main application route views (authenticated)
   - Naming: `*View.vue` (e.g., `DashboardView.vue`, `SettingsView.vue`)
   - Purpose: Main app routes requiring authentication
   - Characteristics:
     - Require authentication to access
     - Show sidebar + header
     - Protected by authGuard

3. **Components (`components/`)** - Reusable UI components
   - Naming: Descriptive name **WITHOUT** "View" suffix
   - Examples: `DeviceDiscoveryCard.vue`, `TechnicalConnection.vue`, `Header.vue`
   - Purpose: Reusable pieces of UI that can be composed
   - Characteristics:
     - Imported and used by pages/views
     - No routing logic
     - Focused, single-purpose components

4. **Layouts (`layouts/`)** - Layout wrapper components
   - Naming: `*Layout.vue` (e.g., `StandaloneLayout.vue`)
   - Purpose: Provide consistent page structure
   - Characteristics:
     - Wrap entire pages
     - Provide common elements (header, theme toggle)
     - Use `<slot>` for content

### When to Use Each Directory

**Use `pages/` when:**
- Creating a new standalone, full-page route
- Building pre-authentication flows (connection, login, setup)
- Page should hide sidebar/header
- Page needs special routing guards

**Use `views/` when:**
- Creating a new authenticated application page
- Building main app features that require login
- Page should show sidebar/header
- Page is part of the main application flow

**Use `components/` when:**
- Building reusable UI pieces
- Creating sub-components used by pages/views
- Component needs to be imported by multiple parents
- Component has no routing logic

**Use `layouts/` when:**
- Creating reusable page structure/templates
- Building wrapper components used by multiple pages
- Providing common page elements (headers, navigation, footers)

### Example File Structure

```
pages/
  ConnectionPage.vue      # Route: /connect
  LoginPage.vue           # Route: /login
  SetupPage.vue           # Route: /setup

views/
  DashboardView.vue       # Route: /dashboard (auth required)
  SettingsView.vue        # Route: /settings (auth required)
  ParametersView.vue      # Route: /parameters (auth required)

components/
  connection/
    TechnicalConnection.vue    # Used by ConnectionPage
    ConsumerConnection.vue     # Used by ConnectionPage
    DeviceDiscoveryCard.vue    # Used by TechnicalConnection
  common/
    Header.vue
    Sidebar.vue
    Modal.vue

layouts/
  StandaloneLayout.vue     # Used by ConnectionPage, LoginPage, SetupPage
```

### Migration Pattern

If you have a view in the wrong directory:

1. **Check its purpose**: Is it pre-auth (pages/) or authenticated (views/)?
2. **Rename appropriately**: Add "Page" suffix if moving to pages/
3. **Extract reusable parts**: Move sub-components to components/
4. **Update imports**: Update router and any other imports
5. **Use layout**: Wrap pages/ with StandaloneLayout

Example migration:
```
# Before
views/ConnectionView.vue  # Wrong location, contains ConsumerConnectionView

# After
pages/ConnectionPage.vue  # Correct location and naming
components/connection/TechnicalConnection.vue   # Extracted component
components/connection/ConsumerConnection.vue    # Moved and renamed
```

## Code Conventions

### Vue Components
```vue
<template>
  <div class="my-component">
    <!-- Use native HTML elements -->
    <button class="btn btn-primary" @click="handleClick">
      <span class="icon">✓</span>
      Save
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useMyStore } from '@/stores/myStore';

// Use Composition API
const myStore = useMyStore();
const count = ref(0);

function handleClick() {
  count.value++;
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables';

.my-component {
  padding: $spacing-md;
  background: $grey-1;
}

.btn {
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;

  &.btn-primary {
    background: $primary;
    color: white;

    &:hover {
      background: darken($primary, 5%);
    }
  }
}
</style>
```

### Pinia Stores
```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useMyStore = defineStore('myStore', () => {
  // State
  const items = ref<Item[]>([]);

  // Computed
  const itemCount = computed(() => items.value.length);

  // Actions
  function addItem(item: Item) {
    items.value.push(item);
  }

  return {
    items,
    itemCount,
    addItem,
  };
});
```

## SCSS Variables

Available color variables (from `@/assets/styles/variables`):

```scss
// Primary colors
$primary: #2C5F2D;        // Primary green
$secondary: #87CEEB;      // Sky blue
$accent: #7CB342;         // Grass green

// Status colors
$positive: #28a745;
$negative: #dc3545;
$warning: #ffc107;
$info: #17a2b8;

// Grey scale
$grey-1: #f8f9fa;
$grey-2: #e9ecef;
$grey-3: #dee2e6;
$grey-4: #ced4da;
$grey-5: #adb5bd;
$grey-6: #6c757d;
$grey-7: #495057;
$grey-8: #343a40;
$grey-9: #212529;

// Text colors
$dark: #212529;

// Spacing
$spacing-xs: 0.25rem;
$spacing-sm: 0.5rem;
$spacing-md: 1rem;
$spacing-lg: 1.5rem;
$spacing-xl: 2rem;
```

## Feature Flags

Features are controlled via the `useFeaturesStore()`:

```typescript
import { useFeaturesStore } from '@/stores/features';

const featuresStore = useFeaturesStore();

// Check if feature is enabled
if (featuresStore.isFeatureEnabled('activityLogs')) {
  // Show activity logs
}
```

Available user modes:
- **Consumer**: Basic features only
- **Power User**: Advanced features
- **Developer**: All features including debugging tools

## Dialog System

### Using Dialogs (Confirm/Alert)

**IMPORTANT**: Always use the `useDialog()` composable instead of native browser dialogs (`confirm()`, `alert()`, `prompt()`).

```typescript
import { useDialog } from '@/composables/useDialog'

const dialog = useDialog()

// Confirmation dialog
async function handleDelete() {
  const confirmed = await dialog.confirm(
    'Are you sure you want to delete this item?',
    'Confirm Delete',
    { variant: 'danger', icon: '⚠️' }
  )

  if (confirmed) {
    // Proceed with delete
  }
}

// Alert dialog
async function showSuccess() {
  await dialog.alert(
    'Item saved successfully!',
    'Success',
    { variant: 'success', icon: '✓' }
  )
}
```

**Available variants**: `default`, `danger`, `warning`, `success`, `info`

**Benefits**:
- ✅ Consistent themed UI
- ✅ Promise-based API (async/await)
- ✅ Keyboard shortcuts (Esc, Enter)
- ✅ Better mobile support
- ✅ Accessibility improvements
- ✅ Custom styling and icons

### Components
- `ConfirmDialog.vue` - Two-button confirmation dialogs
- `AlertDialog.vue` - Single-button alert dialogs
- Dialog manager is set up in [App.vue](src/App.vue)

## Common UI Patterns

### Custom Modal/Form Dialog
```vue
<template>
  <div v-if="showModal" class="modal-overlay" @click="showModal = false">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h2>Title</h2>
        <button @click="showModal = false" class="close-btn">✕</button>
      </div>
      <div class="modal-body">
        Content here
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
      <button @click="handleAction1">Action 1</button>
      <button @click="handleAction2">Action 2</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const isOpen = ref(false);

function toggle() {
  isOpen.value = !isOpen.value;
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (!target.closest('.dropdown')) {
    isOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>
```

## Completed Features

### ✅ Stage 6: Parameter Management
- Parameter editor with validation
- Parameter sets (save/load)
- Group-based organization
- Export/import functionality

### ✅ Stage 7: Activity Logs (Formerly Flight Logs)
- Session log viewer with timeline
- Statistics dashboard
- Data visualization charts
- Export to CSV, KML, GeoJSON, JSON
- Filter and search functionality
- **100% Quasar-free implementation**

### ✅ Dialog System Migration
- Converted all 47 native browser dialogs to Vue components
- Custom `ConfirmDialog` and `AlertDialog` components
- `useDialog()` composable with promise-based API
- Applied across 22 files throughout the application
- Consistent theming with variants for different contexts

## Development Commands

```bash
# Start dev server
npm run dev

# Type check
npm run type-check

# Build for production
npm run build

# Preview production build
npm run preview
```

## Important Notes

1. **No Quasar**: This bears repeating - DO NOT use any Quasar components
2. **Type Safety**: Always use TypeScript with proper typing
3. **SCSS Variables**: Use the centralized variable system for consistency
4. **Composition API**: Use `<script setup>` for all components
5. **Feature Flags**: Check feature flags before showing advanced features
6. **Emoji Icons**: Prefer emoji for simple icons (faster, no dependencies)
7. **Accessibility**: Use semantic HTML and proper ARIA labels
8. **Responsive**: Test on mobile viewports

## Need Help?

Check existing implementations:
- **Confirm/Alert dialogs**: See [useDialog composable](src/composables/useDialog.ts) and any view/component
- **Custom modals**: See [Modal.vue](src/components/common/Modal.vue)
- **Forms**: See [ParametersView.vue](src/views/ParametersView.vue)
- **Timeline**: See [LogTimeline.vue](src/components/logs/LogTimeline.vue)
- **Charts**: See [LogCharts.vue](src/components/logs/LogCharts.vue)
- **Cards/Grids**: See [LogSummary.vue](src/components/logs/LogSummary.vue)

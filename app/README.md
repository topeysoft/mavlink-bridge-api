# YardRover Vue 3 App

A modern Vue 3 application for managing the YardRover autonomous yard management system.

## Tech Stack

- **Vue 3** - Progressive JavaScript framework with Composition API
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Pinia** - State management
- **Vue Router** - Client-side routing
- **SCSS** - Powerful CSS preprocessor with mixins and variables
- **Leaflet** - Interactive maps
- **Chart.js** - Data visualization
- **FullCalendar** - Mission scheduling

## Project Structure

```
app/
├── src/
│   ├── assets/
│   │   └── styles/
│   │       ├── variables.scss    # SCSS variables & CSS custom properties
│   │       └── mixins.scss       # Reusable SCSS mixins
│   ├── components/
│   │   ├── common/               # Shared components (Sidebar, etc.)
│   │   ├── dashboard/
│   │   ├── attachments/
│   │   ├── zones/
│   │   ├── missions/
│   │   ├── monitoring/
│   │   ├── schedule/
│   │   └── settings/
│   ├── composables/              # Reusable composition functions
│   ├── stores/                   # Pinia state stores
│   ├── views/                    # Page components
│   ├── router/                   # Vue Router configuration
│   ├── types/                    # TypeScript type definitions
│   ├── App.vue                   # Root component
│   └── main.ts                   # App entry point
├── public/                       # Static assets
└── index.html                    # HTML template
```

## SCSS Architecture

### Variables (`variables.scss`)

The project uses both **SCSS variables** (for static values) and **CSS custom properties** (for theme switching):

```scss
// SCSS variables
$primary-green: #2C5F2D;
$spacing-md: 1rem;

// CSS custom properties for theming
:root {
  --bg-primary: #ffffff;
  --text-primary: #212529;
}

body[data-theme="dark"] {
  --bg-primary: #1a1d23;
  --text-primary: #e8eaed;
}
```

### Mixins (`mixins.scss`)

Reusable style patterns available throughout the app:

#### Layout Mixins
- `@include flex-center` - Centered flexbox
- `@include flex-between` - Space-between flexbox
- `@include flex-column` - Column flexbox
- `@include auto-grid($min-width, $gap)` - Responsive grid

#### Component Mixins
- `@include card` - Card styling with hover effect
- `@include btn-primary` - Primary button styling
- `@include btn-secondary` - Secondary button styling
- `@include input-base` - Input field styling
- `@include status-badge($color)` - Status badge

#### Utility Mixins
- `@include truncate` - Single-line text truncation
- `@include line-clamp($lines)` - Multi-line truncation
- `@include custom-scrollbar` - Styled scrollbars
- `@include mobile { ... }` - Mobile breakpoint
- `@include tablet { ... }` - Tablet breakpoint
- `@include desktop { ... }` - Desktop breakpoint

### Usage in Components

```vue
<style scoped lang="scss">
@use '@/assets/styles/mixins' as *;

.my-component {
  @include card;
  @include auto-grid(280px);

  h1 {
    color: var(--text-primary);
    font-size: var(--font-size-2xl);
  }

  .button {
    @include btn-primary;
  }

  @include mobile {
    padding: var(--spacing-sm);
  }
}
</style>
```

**Note:** We use `@use` instead of the deprecated `@import`. The `as *` allows us to use mixins without a namespace prefix.

## Development

### Install Dependencies
```bash
npm install
```

### Start Dev Server
```bash
npm run dev
```

Server runs at http://localhost:5173

### Build for Production
```bash
npm run build
```

### Type-Check
```bash
npm run type-check
```

## State Management

The app uses Pinia stores for centralized state:

- **theme** - Light/dark mode with persistence
- **zones** - Coverage zone management
- **missions** - Mission planning and tracking
- **monitoring** - Telemetry and MAVLink messages
- **attachments** - Equipment management

## Theming

Toggle between light and dark themes using the sidebar button. Theme preference is persisted to localStorage.

## Features

- ✅ Responsive layout with collapsible sidebar
- ✅ Light/dark theme support
- ✅ Type-safe with TypeScript
- ✅ SCSS with mixins and variables
- ✅ State management with Pinia
- ✅ Client-side routing
- 🚧 Real-time data visualization
- 🚧 Interactive map zones
- 🚧 Mission scheduling

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar)

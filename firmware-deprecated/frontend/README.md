# YardRover Frontend Application

A comprehensive nature-themed web application for controlling an autonomous multi-tasking yard utility machine.

## Technology Stack

- **Frontend Framework:** Vue 3 with Composition API (script setup)
- **Language:** TypeScript
- **UI Framework:** Quasar 2
- **State Management:** Pinia
- **Styling:** SCSS with nature-themed design system
- **Build Tool:** Vite
- **Mobile:** Capacitor (iOS/Android)
- **Desktop:** Electron (Windows/macOS/Linux)

## Prerequisites

- **Node.js:** 20.19+ or 22.12+ (Current environment has 18.20.2)
- **npm:** 10.5.0+

## Project Status

✅ **Completed (Stage 1 - Project Setup):**


- Project structure created
- Dependencies installed
- TypeScript configuration
- Vue 3 + Quasar 2 setup
- Basic routing configuration
- Nature-themed SCSS variables
- Electron and Capacitor configuration
- Basic views and navigation
- Development environment setup

⚠️ **Current Issue:**
The project requires Node.js 20.19+ to run properly. The current environment has Node.js 18.20.2, which causes compatibility issues with Vite 7.x and other modern dependencies.

## Project Structure

```
frontend/
├── src/
│   ├── components/         # Vue components (ready for expansion)
│   ├── composables/        # Reusable composition functions
│   ├── services/           # API services
│   ├── stores/             # Pinia stores
│   ├── views/              # Page components (basic versions created)
│   │   ├── Dashboard.vue   # Main dashboard
│   │   ├── MachineControl.vue  # Machine control interface
│   │   ├── Tasks.vue       # Task management
│   │   ├── YardMap.vue     # Yard mapping
│   │   └── Settings.vue    # Application settings
│   ├── styles/             # SCSS files
│   │   ├── main.scss       # Main stylesheet
│   │   └── quasar-variables.scss  # Nature theme variables
│   ├── router/             # Vue Router configuration
│   └── utils/              # Utility functions
├── electron/               # Electron main process
├── prompts/                # Development stage prompts
├── capacitor.config.ts     # Capacitor configuration
├── vite.config.ts          # Vite configuration
└── package.json            # Dependencies and scripts
```

## Nature Theme Colors

- **Grass Green:** #4CAF50 (primary operations)
- **Sky Blue:** #2196F3 (status and information)
- **Earth Brown:** #795548 (grounding elements)
- **Snow White:** #FAFAFA (winter operations)
- **Leaf Orange:** #FF9800 (autumn operations)
- **Sun Yellow:** #FFC107 (warnings and highlights)
- **Storm Gray:** #607D8B (disabled states)

## Prerequisites

### Node.js Version Management

This project requires **Node.js 22.15.0** for optimal compatibility with Vite 7.x and modern build tools.

**Using nvm (recommended):**
```bash
# Install and use the correct Node.js version
nvm use

# Or install if not available
nvm install 22.15.0
nvm use 22.15.0
```

The `.nvmrc` file ensures consistent Node.js versions across all development environments.

**Verify installation:**
```bash
node --version  # Should output: v22.15.0
npm --version   # Should output: 10.9.2 or higher
```

## State Tracking System

This project includes a comprehensive state tracking system to monitor development progress across multiple AI sessions. The state tracker maintains:

- **Stage Progress**: 10 development stages with completion percentages
- **Session Management**: Track AI sessions and development history
- **Issue Tracking**: Monitor and resolve development blockers
- **Next Actions**: Prioritized todo list with time estimates
- **Architecture Decisions**: Document key technical choices

### State File Structure

The `.yardrover-state.json` file contains:
- Project metadata (Node.js version, last updated, etc.)
- Development progress (current stage, session count)
- Detailed stage information with completion status
- Next action items with priorities
- Development notes and issue tracking

### Usage Examples

```bash
# View current status
npm run state

# Complete a stage
npm run state:complete 2

# Add development notes
npm run state:note "Fixed SCSS import issues"

# Start new session
npm run state:session
```

This ensures continuity across different development sessions and helps maintain project momentum.

## Development Scripts

### Core Development
```bash
npm run dev           # Start development server
npm run build         # Build for production
npm run preview       # Preview production build
npm run lint          # Run ESLint with auto-fix
npm run type-check    # TypeScript type checking
```

### State Tracking
```bash
npm run state              # Show current project status
npm run state:complete 2   # Mark stage 2 as completed
npm run state:note "text"  # Add a development note
npm run state:session      # Start new AI session tracking
```

### Cross-Platform Development
```bash
# Electron (Desktop)
npm run electron:dev    # Development with Electron
npm run electron:build  # Build desktop app

# Capacitor (Mobile)
npm run cap:add:ios     # Add iOS platform
npm run cap:add:android # Add Android platform
npm run cap:sync        # Sync web assets
npm run cap:open:ios    # Open in Xcode
npm run cap:open:android # Open in Android Studio
npm run build:mobile    # Build for mobile platforms
```

## Next Steps

1. **Upgrade Node.js** to version 20.19+ or 22.12+
2. Continue with **Stage 2: Nature Theme and Design System**
3. Follow the staged development prompts in `/prompts/` directory

## Stage-by-Stage Development

This project is designed to be built in stages. Each stage has a detailed prompt file:

1. **Stage 1:** ✅ Project Setup and Configuration (COMPLETED)
2. **Stage 2:** Nature Theme and Design System
3. **Stage 3:** API Services and Integration Layer
4. **Stage 4:** State Management with Pinia
5. **Stage 5:** Core Vue Components Development
6. **Stage 6:** Views and Routing Configuration
7. **Stage 7:** Vue Composables and Utilities
8. **Stage 8:** Cross-Platform Mobile and Desktop Development
9. **Stage 9:** Testing and Performance Optimization
10. **Stage 10:** Deployment and CI/CD

## Features Planned

- Real-time machine status monitoring
- Interactive yard mapping and zone management
- Task scheduling with calendar integration
- Weather-aware operation suggestions
- Battery and system health monitoring
- Multi-mode operation control (mowing, snow clearing, leaf blowing, towing, patrolling)
- Historical data and analytics
- Push notifications for important events
- Offline mode with sync capabilities
- Cross-platform compatibility

## Environment Variables

The project uses environment-specific configuration:

- `.env.development` - Development settings
- `.env.production` - Production settings

## License

Private project for YardRover autonomous yard machine control system.

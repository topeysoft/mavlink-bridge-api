# YardRover Frontend Development Stages

## Overview

This directory contains comprehensive prompts for building the YardRover web application in stages. Each stage is designed to be completed in a single or multiple AI coding sessions, ensuring continuity and systematic development.

## Application Description

YardRover is a nature-themed, responsive web application for controlling an autonomous multi-tasking yard utility machine capable of:
- Mowing
- Snow clearing
- Leaf blowing
- Towing
- Patrolling

The application is built with modern web technologies and supports cross-platform deployment to web, mobile (iOS/Android), and desktop (Windows/macOS/Linux).

## Technology Stack

- **Frontend Framework:** Vue 3 with Composition API (script setup)
- **Language:** TypeScript
- **UI Framework:** Quasar 2
- **State Management:** Pinia
- **Styling:** SCSS with nature-themed design system
- **Build Tool:** Vite
- **Mobile:** Capacitor
- **Desktop:** Electron
- **Testing:** Vitest, Cypress
- **API Communication:** Axios, WebSocket

## Development Stages

### Stage 1: Project Setup and Configuration
- Initialize Vue 3 project with all dependencies
- Configure TypeScript, Quasar, Pinia
- Set up Electron and Capacitor
- Configure development environment

### Stage 2: Nature Theme and Design System
- Create nature-inspired color palette
- Design custom SCSS variables and mixins
- Configure Quasar theme
- Implement responsive design system
- Set up dark mode support

### Stage 3: API Services and Integration Layer
- Create API service architecture
- Implement WebSocket for real-time updates
- Handle authentication and tokens
- Create TypeScript interfaces
- Set up error handling and retry logic

### Stage 4: State Management with Pinia
- Design store architecture
- Implement machine control store
- Create task management store
- Set up real-time state synchronization
- Implement persistence and undo/redo

### Stage 5: Core Vue Components Development
- Build machine control components
- Create status monitoring displays
- Develop task scheduling interface
- Implement yard map visualization
- Create reusable UI component library

### Stage 6: Views and Routing Configuration
- Set up Vue Router
- Create main application views
- Implement navigation structure
- Configure route guards
- Add view transitions

### Stage 7: Vue Composables and Utilities
- Create reusable composables
- Build real-time data synchronization
- Implement geolocation utilities
- Create notification system
- Develop form validation helpers

### Stage 8: Cross-Platform Mobile and Desktop Development
- Configure Capacitor for mobile
- Set up Electron for desktop
- Implement platform-specific features
- Create responsive layouts
- Configure native permissions

### Stage 9: Testing and Performance Optimization
- Set up unit testing with Vitest
- Configure E2E testing with Cypress
- Implement performance monitoring
- Optimize bundle size
- Configure PWA features

### Stage 10: Deployment and CI/CD
- Set up GitHub Actions workflows
- Configure automated testing
- Implement multi-platform builds
- Set up app store deployments
- Configure monitoring and analytics

## Getting Started

1. Start with Stage 1 to set up the project foundation
2. Follow each stage sequentially for best results
3. Each stage builds upon the previous ones
4. Test thoroughly after each stage completion
5. Commit changes after each major milestone

## Project Structure

```
frontend/
├── src/
│   ├── components/     # Vue components
│   ├── composables/    # Reusable composition functions
│   ├── services/       # API services
│   ├── stores/         # Pinia stores
│   ├── views/          # Page components
│   ├── styles/         # SCSS files
│   ├── utils/          # Utility functions
│   └── App.vue         # Root component
├── public/             # Static assets
├── tests/              # Test files
├── electron/           # Electron main process
├── android/            # Android platform files
├── ios/                # iOS platform files
└── prompts/            # Development stage prompts
```

## Design Principles

1. **Nature-Themed UI:** Use natural colors and imagery
2. **Responsive Design:** Work seamlessly across all devices
3. **Real-Time Updates:** Show live machine status and location
4. **Offline Capability:** Function without constant connectivity
5. **Intuitive Controls:** Easy-to-use interface for all users

## Key Features

- Real-time machine status monitoring
- Interactive yard mapping and zone management
- Task scheduling with calendar integration
- Weather-aware operation suggestions
- Battery and system health monitoring
- Multi-mode operation control
- Historical data and analytics
- Push notifications for important events
- Offline mode with sync capabilities
- Cross-platform compatibility

## Development Tips

- Use the composables for shared logic
- Follow the established naming conventions
- Implement proper error handling
- Add loading states for all async operations
- Test on multiple screen sizes
- Consider accessibility requirements
- Document complex logic
- Use TypeScript strictly for type safety

## Next Steps

Begin with [Stage 1: Project Setup](./stage-1-project-setup.md) to initialize the YardRover frontend application.

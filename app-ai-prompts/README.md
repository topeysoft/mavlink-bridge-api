# YardRover Web Application - AI Development Prompts

This directory contains structured prompts for AI-assisted development of the YardRover control application. Each stage builds upon the previous ones to create a comprehensive, nature-themed web application.

## Overview

The YardRover Control Application is a modern web application built with:
- Vue 3 (Composition API with `<script setup>`)
- TypeScript
- SCSS
- Pinia (state management)
- Quasar 2 (UI framework)
- Electron (desktop)
- Capacitor (mobile)

## Design Philosophy

The application features a nature-inspired design theme that reflects the outdoor utility purpose of the YardRover:

### Color Palette
- **Primary**: Forest Green (#2C5F2D) - Represents grass and nature
- **Secondary**: Sky Blue (#87CEEB) - Represents open skies
- **Accent**: Sunset Orange (#FF6B35) - For important actions
- **Background**: Soft Beige (#F5F5DC) - Natural, easy on eyes
- **Text**: Dark Earth (#3E2723) - High contrast, readable

### Visual Elements
- Rounded, organic shapes
- Natural textures and patterns
- Weather-appropriate animations
- Seasonal theme variations
- Soft shadows and gradients

## Development Stages

> **Progress Tracking**: See [PROGRESS.md](../PROGRESS.md) for detailed implementation status

### ✅ Stage 1: Project Setup & Core Infrastructure
**Status**: Complete | **Updated**: 2025-09-02  
Sets up the Quasar project with all necessary dependencies and configurations for cross-platform development.

**Key Implementations:**
- Vue 3 + Quasar 2 + TypeScript setup
- Nature-inspired theme system with SCSS variables
- Pinia state management with composition API
- Responsive MainLayout with navigation
- Cross-platform build configuration

### ✅ Stage 2: Connection & Device Management  
**Status**: Complete | **Updated**: 2025-09-02  
Implements device discovery, connection management, and real-time connection monitoring.

**Key Implementations:**
- Enhanced connection store with health monitoring
- mDNS device discovery via client library
- Saved devices with LocalStorage persistence
- Real-time connection status and quality indicators
- Auto-reconnection with exponential backoff
- Manual connection with URL validation
- Device management (save/remove/nickname/favorites)

### ⏳ Stage 3: Dashboard & Status Monitoring
**Status**: Pending | **Next Priority**  
Creates the main dashboard with real-time telemetry, system health, and quick actions.

### ⏳ Stage 4: Machine Control Interface
**Status**: Pending  
Builds control interfaces for all machine functions with safety features and intuitive controls.

### ⏳ Stage 5: Map & Mission Planning
**Status**: Pending  
Implements interactive mapping with mission planning tools and pattern generation.

### ⏳ Stage 6: Task Management System
**Status**: Pending  
Creates comprehensive task creation, scheduling, and management functionality.

### ⏳ Stage 7: Settings & Configuration
**Status**: Pending  
Builds configuration interfaces for device settings, parameters, and user preferences.

### ⏳ Stage 8: Advanced Features
**Status**: Pending  
Adds multi-device support, automation, analytics, and integration features.

### ⏳ Stage 9: Mobile Optimization
**Status**: Pending  
Optimizes the application for mobile devices with touch controls and native features.

### ⏳ Stage 10: Testing & Deployment
**Status**: Pending  
Implements testing, optimization, and deployment configurations.

## Using the Prompts

Each prompt is designed to be used with an AI coding assistant. The prompts include:
- Specific technical requirements
- Code examples and patterns to follow
- UI/UX guidelines
- Integration points with the existing API

## Project Structure

```
app/
├── src/
│   ├── assets/
│   │   ├── images/
│   │   └── styles/
│   ├── components/
│   │   ├── connection/
│   │   ├── control/
│   │   ├── dashboard/
│   │   ├── health/
│   │   ├── layout/
│   │   ├── map/
│   │   ├── mission/
│   │   ├── parameters/
│   │   ├── rtcm/
│   │   ├── settings/
│   │   ├── tasks/
│   │   └── wifi/
│   ├── composables/
│   ├── layouts/
│   ├── pages/
│   ├── router/
│   ├── stores/
│   ├── services/
│   └── utils/
├── electron/
├── src-capacitor/
├── public/
└── quasar.config.ts
```

## Key Features

- **Real-time Communication**: WebSocket integration for live updates
- **Offline Capability**: Local storage and queue management
- **Cross-platform**: Single codebase for web, desktop, and mobile
- **Responsive Design**: Adaptive layouts for all screen sizes
- **Accessibility**: WCAG compliant with keyboard navigation
- **Performance**: Optimized rendering and lazy loading
- **Security**: Secure communication and data handling

## API Integration

The application integrates with the YardRover API through the `@mavlinkbridge/api-client` TypeScript client library, providing:
- Type-safe API calls
- Automatic reconnection
- Event handling
- Error management
- Request queuing
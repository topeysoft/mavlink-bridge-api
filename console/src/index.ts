#!/usr/bin/env node

/**
 * YardRover Console Manager
 * 
 * An interactive console application for managing MAVLinkBridge ESP32 devices.
 * Provides comprehensive control over device configuration, WiFi management,
 * MAVLink communication, task execution, and system monitoring.
 */

import { ConsoleApp } from './core/ConsoleApp.js';

async function main(): Promise<void> {
  try {
    // Create and start the console application
    const app = new ConsoleApp();
    await app.start();
    
    // Exit gracefully
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle SIGTERM and SIGINT gracefully
process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Start the application
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
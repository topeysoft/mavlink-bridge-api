#pragma once

// Build configuration
#define VERSION_MAJOR 1
#define VERSION_MINOR 0
#define VERSION_PATCH 0

// Memory allocation limits
#define MAX_HTTP_CONNECTIONS 4
#define MAX_WEBSOCKET_CONNECTIONS 3
#define MAX_EVENT_SUBSCRIPTIONS 32
#define MAX_QUEUED_EVENTS_APP 10

// Buffer sizes
#define HTTP_BUFFER_SIZE 1024
#define WEBSOCKET_BUFFER_SIZE 512
#define CONFIG_BUFFER_SIZE_APP 2048
#define EVENT_PAYLOAD_SIZE 256

// Network configuration
#define DEFAULT_AP_SSID "MAVLinkBridge-Setup"
#define DEFAULT_AP_PASSWORD "mavlinkbridge123"
#define HTTP_PORT 80
#define WEBSOCKET_PATH "/ws"

// Timing configuration
#define HEALTH_REPORT_INTERVAL 30000  // 30 seconds
#define WEBSOCKET_PING_INTERVAL 10000 // 10 seconds
#define WEBSOCKET_CLIENT_TIMEOUT 30000 // 30 seconds
#define HTTP_REQUEST_TIMEOUT 5000 // 5 seconds

// Task configuration
#define HTTP_TASK_STACK_SIZE_APP 2048
#define WEBSOCKET_TASK_STACK_SIZE_APP 2048
#define EVENT_TASK_STACK_SIZE_APP 2048
#define HTTP_TASK_PRIORITY_APP 1
#define WEBSOCKET_TASK_PRIORITY_APP 1
#define EVENT_TASK_PRIORITY_APP 1

// Debug configuration
#define DEBUG_LEVEL 1
#define ENABLE_SERIAL_DEBUG true
#define SERIAL_BAUD_RATE 115200

// Feature flags
#define ENABLE_WEBSOCKET true
#define ENABLE_EVENT_MANAGER true
#define ENABLE_CONFIG_PERSISTENCE true // Stage 2 feature
#define ENABLE_WIFI_MANAGER true // Stage 3 feature
#define ENABLE_RTCM_CLIENT false // Stage 4 feature
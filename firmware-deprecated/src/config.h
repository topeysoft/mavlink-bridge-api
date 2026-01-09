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
#define HEALTH_REPORT_INTERVAL 30000   // 30 seconds
#define WEBSOCKET_PING_INTERVAL 10000  // 10 seconds
#define WEBSOCKET_CLIENT_TIMEOUT 30000 // 30 seconds
#define HTTP_REQUEST_TIMEOUT 5000      // 5 seconds

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
#define ENABLE_WIFI_MANAGER true       // Stage 3 feature
#define ENABLE_RTCM_CLIENT false       // Stage 4 feature

// Button configuration
#define BOOT_BUTTON_PIN 0                // GPIO0 is the BOOT button on most ESP32 boards
#define BUTTON_LONG_PRESS_MS 3000        // 3 seconds to trigger AP mode
#define BUTTON_DEBOUNCE_MS 50            // 50ms debounce delay
#define ENABLE_COMMUNICATION_SYSTEM true // Stage 5 feature

// Communication system configuration (Stage 5)
#define ENABLE_USB_OTG true
#define ENABLE_UART_COMMUNICATION true
#define ENABLE_MAVLINK_PROCESSING true

// USB OTG configuration
#define USB_OTG_BUFFER_SIZE 4096
#define USB_OTG_TASK_STACK_SIZE 4096
#define USB_OTG_TASK_PRIORITY 6

// UART configuration
#define DEFAULT_UART_NUM 1
#define DEFAULT_UART_RX_PIN 16
#define DEFAULT_UART_TX_PIN 17
#define DEFAULT_UART_RTS_PIN 255 // Disabled
#define DEFAULT_UART_CTS_PIN 255 // Disabled
#define DEFAULT_UART_BAUD_RATE 57600
#define UART_BUFFER_SIZE 4096
#define UART_TASK_STACK_SIZE 4096
#define UART_TASK_PRIORITY 5
#define ENABLE_UART_AUTO_BAUD true
#define ENABLE_UART_FLOW_CONTROL false

// MAVLink processor configuration
#define MAVLINK_BUFFER_SIZE 512
#define MAVLINK_MAX_MESSAGE_TYPES 256
#define ENABLE_MAVLINK_FILTERING false
#define ENABLE_MAVLINK_SEQUENCE_CHECK true

// Data router configuration
#define DATA_ROUTER_BUFFER_SIZE 8192
#define DATA_ROUTER_QUEUE_SIZE 32
#define DATA_ROUTER_TASK_STACK_SIZE 8192
#define DATA_ROUTER_TASK_PRIORITY 7
#define DEFAULT_ROUTING_MODE 0               // AUTO
#define INTERFACE_HEALTH_CHECK_INTERVAL 5000 // 5 seconds
#define INTERFACE_SWITCH_TIMEOUT 1000        // 1 second

// Communication statistics
#define COMM_STATS_UPDATE_INTERVAL 1000 // 1 second
#define ENABLE_COMM_STATISTICS true

// Performance settings
#define COMM_MAX_THROUGHPUT 1000000 // 1 Mbps
#define COMM_MAX_PACKET_SIZE 256
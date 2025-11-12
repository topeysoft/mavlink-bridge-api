// Simplified types for initial setup
// Will be replaced with actual client library types later

// Additional app-specific types
export interface AppConfig {
  theme: 'spring' | 'summer' | 'autumn' | 'winter';
  darkMode: boolean;
  autoConnect: boolean;
  defaultUrl: string;
}

export interface ConnectionState {
  isConnected: boolean;
  url?: string;
  lastConnected?: Date;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
}

export interface NotificationOptions {
  type: 'positive' | 'negative' | 'warning' | 'info';
  message: string;
  timeout?: number;
}

export type { MAVLinkBridgeClient, MAVLinkBridgeDevice } from '@mavlinkbridge/api-client';
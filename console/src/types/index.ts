import { MAVLinkBridgeClient } from '@mavlinkbridge/api-client';

export interface ConsoleContext {
  client: MAVLinkBridgeClient | null;
  deviceUrl: string | null;
  connected: boolean;
  currentMenu: string;
  exitRequested: boolean;
}

export interface MenuItem {
  key: string;
  label: string;
  description: string;
  action?: () => Promise<void>;
  submenu?: MenuItem[];
  requiresConnection?: boolean;
}

export interface CommandInfo {
  name: string;
  description: string;
  usage: string;
  examples?: string[];
  requiresConnection?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  suggestion?: string;
}

export interface DisplayOptions {
  colors?: boolean;
  compact?: boolean;
  maxWidth?: number;
}
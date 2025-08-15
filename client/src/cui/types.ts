import { MAVLinkBridgeClient } from '../MAVLinkBridgeClient';

export interface CommandContext {
  client: MAVLinkBridgeClient | null;
  isConnected: boolean;
  deviceUrl: string;
  verbose: boolean;
  monitoring: boolean;
}

export interface CommandArgs {
  [key: string]: any;
}

export interface Command {
  name: string;
  description: string;
  category?: string;
  aliases?: string[];
  usage?: string;
  examples?: string[];
  requiresConnection?: boolean;
  execute: (context: CommandContext, args: CommandArgs) => Promise<void>;
}

export interface CUIConfig {
  defaultDeviceUrl: string;
  autoConnect: boolean;
  verbose: boolean;
  colorOutput: boolean;
  historySize: number;
  commandTimeout: number;
}

export interface EventListener {
  type: string;
  handler: (...args: any[]) => void;
  unsubscribe?: () => void;
}
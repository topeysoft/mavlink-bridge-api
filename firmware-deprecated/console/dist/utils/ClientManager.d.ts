import { MAVLinkBridgeClient } from '@mavlinkbridge/api-client';
import type { DiscoveryOptions, DiscoveryResult } from '@mavlinkbridge/api-client';
import { ConsoleContext } from '../types/index.js';
export declare class ClientManager {
    private context;
    setContext(context: ConsoleContext): void;
    discoverDevices(options?: DiscoveryOptions, onProgress?: (message: string) => void): Promise<DiscoveryResult>;
    /**
     * Quick helper method for backward compatibility
     */
    discoverDeviceUrls(timeout?: number): Promise<string[]>;
    connect(deviceUrl: string): Promise<boolean>;
    disconnect(): Promise<void>;
    testConnection(): Promise<boolean>;
    private setupEventListeners;
    getClient(): MAVLinkBridgeClient | null;
    isConnected(): boolean;
    getDeviceUrl(): string | null;
}
//# sourceMappingURL=ClientManager.d.ts.map
import { ConsoleContext } from '../types/index.js';
import { ClientManager } from '../utils/ClientManager.js';
import { UIHelpers } from '../core/UIHelpers.js';
export declare class DeviceCommands {
    private context;
    private clientManager;
    private uiHelpers;
    private errorHandler;
    private profileManager;
    constructor(context: ConsoleContext, clientManager: ClientManager, uiHelpers: UIHelpers);
    discoverDevices(): Promise<void>;
    private configureDiscoveryOptions;
    private configureAdvancedOptions;
    private selectDiscoveryProfile;
    private saveDiscoveryProfile;
    private displayDiscoveryResults;
    connectToDevice(): Promise<void>;
    private connectToSpecificDevice;
    testConnection(): Promise<void>;
    showDeviceInfo(): Promise<void>;
    showSystemHealth(): Promise<void>;
    showSystemMetrics(): Promise<void>;
    startMonitoring(): Promise<void>;
    viewLogs(): Promise<void>;
    disconnect(): Promise<void>;
}
//# sourceMappingURL=DeviceCommands.d.ts.map
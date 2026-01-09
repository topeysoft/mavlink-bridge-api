import { ConsoleContext } from '../types/index.js';
import { ClientManager } from '../utils/ClientManager.js';
import { UIHelpers } from '../core/UIHelpers.js';
export declare class WiFiCommands {
    private context;
    private clientManager;
    private uiHelpers;
    constructor(context: ConsoleContext, clientManager: ClientManager, uiHelpers: UIHelpers);
    showStatus(): Promise<void>;
    scanNetworks(): Promise<void>;
    connectToNetwork(): Promise<void>;
    disconnect(): Promise<void>;
    manageSavedNetworks(): Promise<void>;
    manageAccessPoint(): Promise<void>;
    private getSignalBars;
    private selectAndConnectNetwork;
    private scanAndConnect;
    private manualConnect;
    private connectToSpecificNetwork;
    private connectToSavedNetwork;
    private connectToSavedNetworkFromList;
    private removeSavedNetwork;
    private toggleAccessPoint;
    private configureAccessPoint;
    private viewConnectedClients;
}
//# sourceMappingURL=WiFiCommands.d.ts.map
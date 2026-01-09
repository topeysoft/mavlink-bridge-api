import { ConsoleContext } from '../types/index.js';
import { ClientManager } from '../utils/ClientManager.js';
import { UIHelpers } from '../core/UIHelpers.js';
export declare class ConfigCommands {
    private context;
    private clientManager;
    private uiHelpers;
    constructor(context: ConsoleContext, clientManager: ClientManager, uiHelpers: UIHelpers);
    viewConfiguration(): Promise<void>;
    editConfiguration(): Promise<void>;
    backupConfiguration(): Promise<void>;
    restoreConfiguration(): Promise<void>;
    resetConfiguration(): Promise<void>;
    private editDeviceSettings;
    private editWiFiSettings;
    private editRTCMSettings;
    private updateRTCMSource;
}
//# sourceMappingURL=ConfigCommands.d.ts.map
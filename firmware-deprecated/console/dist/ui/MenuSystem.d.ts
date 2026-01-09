import { ConsoleContext } from '../types/index.js';
import { ClientManager } from '../utils/ClientManager.js';
import { UIHelpers } from '../core/UIHelpers.js';
export declare class MenuSystem {
    private context;
    private clientManager;
    private uiHelpers;
    private commands;
    constructor(context: ConsoleContext, clientManager: ClientManager, uiHelpers: UIHelpers);
    displayMainMenu(): Promise<void>;
    private displayMenu;
    private displayHeader;
    private displayConnectionStatus;
    private deviceMenu;
    private healthMenu;
    private configMenu;
    private wifiMenu;
    private mavlinkMenu;
    private taskMenu;
    private rtcmMenu;
    private toolsMenu;
    private toggleDebugMode;
    private exportData;
    private updateFirmware;
    private exit;
}
//# sourceMappingURL=MenuSystem.d.ts.map
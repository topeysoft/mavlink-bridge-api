import { ConsoleContext } from '../types/index.js';
import { ClientManager } from '../utils/ClientManager.js';
import { UIHelpers } from '../core/UIHelpers.js';
export declare class RTCMCommands {
    private context;
    private clientManager;
    private uiHelpers;
    constructor(context: ConsoleContext, clientManager: ClientManager, uiHelpers: UIHelpers);
    viewStatus(): Promise<void>;
    startClient(): Promise<void>;
    private configureAndStart;
    stopClient(): Promise<void>;
    monitorRealtime(): Promise<void>;
}
//# sourceMappingURL=RTCMCommands.d.ts.map
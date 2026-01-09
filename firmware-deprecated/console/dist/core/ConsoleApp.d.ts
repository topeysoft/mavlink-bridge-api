import { ConsoleContext } from '../types/index.js';
export declare class ConsoleApp {
    private context;
    private menuSystem;
    private clientManager;
    private uiHelpers;
    constructor();
    start(): Promise<void>;
    private displayWelcome;
    private shutdown;
    getContext(): ConsoleContext;
}
//# sourceMappingURL=ConsoleApp.d.ts.map
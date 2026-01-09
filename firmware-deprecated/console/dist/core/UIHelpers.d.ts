import Table from 'cli-table3';
import { ValidationResult, DisplayOptions } from '../types/index.js';
export declare class UIHelpers {
    displayError(message: string, error?: any): void;
    displaySuccess(message: string): void;
    displayWarning(message: string): void;
    displayInfo(message: string): void;
    displayStatus(label: string, status: string, isOnline?: boolean): void;
    createTable(headers: string[], options?: any): Table.Table;
    pressAnyKey(message?: string): Promise<void>;
    confirmAction(message: string, defaultValue?: boolean): Promise<boolean>;
    getTextInput(message: string, defaultValue?: string, validate?: (input: string) => ValidationResult): Promise<string>;
    getNumberInput(message: string, defaultValue?: number, min?: number, max?: number): Promise<number>;
    selectFromList<T>(message: string, choices: Array<{
        name: string;
        value: T;
        description?: string;
    }>): Promise<T>;
    multiSelect<T>(message: string, choices: Array<{
        name: string;
        value: T;
        checked?: boolean;
    }>): Promise<T[]>;
    displayProgressBar(current: number, total: number, label?: string): void;
    formatBytes(bytes: number, decimals?: number): string;
    formatDuration(milliseconds: number): string;
    displayKeyValuePairs(data: Record<string, any>, options?: DisplayOptions): void;
    clearScreen(): void;
    displaySeparator(char?: string, length?: number): void;
}
//# sourceMappingURL=UIHelpers.d.ts.map
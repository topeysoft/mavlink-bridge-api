import { UIHelpers } from '../core/UIHelpers.js';
export interface ErrorContext {
    operation: string;
    component?: string;
    details?: any;
}
export interface RetryOptions {
    maxAttempts: number;
    delayMs: number;
    backoffMultiplier?: number;
    retryableErrors?: string[];
}
export declare class ErrorHandler {
    private uiHelpers;
    constructor(uiHelpers: UIHelpers);
    /**
     * Handle and display errors with enhanced context and user-friendly messages
     */
    handleError(error: any, context: ErrorContext): void;
    /**
     * Retry an operation with exponential backoff
     */
    withRetry<T>(operation: () => Promise<T>, options: RetryOptions, context: ErrorContext): Promise<T>;
    /**
     * Handle connection-related errors with specific guidance
     */
    handleConnectionError(error: any, context: ErrorContext): void;
    /**
     * Handle API errors with specific response analysis
     */
    handleApiError(error: any, context: ErrorContext): void;
    /**
     * Handle validation errors with field-specific guidance
     */
    handleValidationError(error: any, context: ErrorContext): void;
    /**
     * Create a wrapped version of an async function with enhanced error handling
     */
    wrapWithErrorHandling<T extends any[], R>(fn: (...args: T) => Promise<R>, context: ErrorContext): (...args: T) => Promise<R>;
    private getFriendlyErrorMessage;
    private extractTechnicalDetails;
    private shouldRetry;
}
//# sourceMappingURL=ErrorHandler.d.ts.map
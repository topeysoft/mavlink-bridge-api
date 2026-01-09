import chalk from 'chalk';
export class ErrorHandler {
    uiHelpers;
    constructor(uiHelpers) {
        this.uiHelpers = uiHelpers;
    }
    /**
     * Handle and display errors with enhanced context and user-friendly messages
     */
    handleError(error, context) {
        const friendlyMessage = this.getFriendlyErrorMessage(error, context);
        const technicalDetails = this.extractTechnicalDetails(error);
        this.uiHelpers.displayError(friendlyMessage);
        // Show technical details in debug mode or for development
        if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
            console.log(chalk.gray('\n🔍 Technical Details:'));
            console.log(chalk.gray(`Operation: ${context.operation}`));
            if (context.component) {
                console.log(chalk.gray(`Component: ${context.component}`));
            }
            console.log(chalk.gray(`Error Type: ${error?.constructor?.name || 'Unknown'}`));
            console.log(chalk.gray(`Message: ${error?.message || 'No message'}`));
            if (technicalDetails) {
                console.log(chalk.gray(`Details: ${JSON.stringify(technicalDetails, null, 2)}`));
            }
        }
    }
    /**
     * Retry an operation with exponential backoff
     */
    async withRetry(operation, options, context) {
        let lastError;
        let delay = options.delayMs;
        for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                lastError = error;
                // Check if this error should be retried
                if (!this.shouldRetry(error, options.retryableErrors)) {
                    throw error;
                }
                // Don't retry on the last attempt
                if (attempt === options.maxAttempts) {
                    break;
                }
                console.log(chalk.yellow(`⚠️  ${context.operation} failed (attempt ${attempt}/${options.maxAttempts}), retrying in ${delay}ms...`));
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, delay));
                // Increase delay for next attempt (exponential backoff)
                if (options.backoffMultiplier) {
                    delay *= options.backoffMultiplier;
                }
            }
        }
        // If we get here, all retries failed
        throw lastError;
    }
    /**
     * Handle connection-related errors with specific guidance
     */
    handleConnectionError(error, context) {
        const errorMessage = error?.message?.toLowerCase() || '';
        const errorCode = error?.code || error?.errno;
        let friendlyMessage = 'Connection failed';
        let suggestions = [];
        // Analyze error patterns and provide specific guidance
        if (errorCode === 'ECONNREFUSED' || errorMessage.includes('connection refused')) {
            friendlyMessage = 'Device refused connection';
            suggestions = [
                'Check if the device is powered on and responsive',
                'Verify the device URL is correct',
                'Ensure the device is on the same network'
            ];
        }
        else if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout')) {
            friendlyMessage = 'Connection timed out';
            suggestions = [
                'Check your network connection',
                'Try connecting to the device AP mode (192.168.4.1)',
                'Verify the device is responding to ping'
            ];
        }
        else if (errorCode === 'ENOTFOUND' || errorMessage.includes('not found')) {
            friendlyMessage = 'Device not found on network';
            suggestions = [
                'Check if the device hostname/IP is correct',
                'Try using the device\'s IP address instead of hostname',
                'Ensure you\'re on the same network as the device'
            ];
        }
        else if (errorMessage.includes('network') || errorMessage.includes('unreachable')) {
            friendlyMessage = 'Network unreachable';
            suggestions = [
                'Check your WiFi connection',
                'Try connecting to device AP mode first',
                'Verify network settings and firewall'
            ];
        }
        this.uiHelpers.displayError(friendlyMessage);
        if (suggestions.length > 0) {
            console.log(chalk.blue('\n💡 Suggestions:'));
            suggestions.forEach(suggestion => {
                console.log(chalk.gray(`• ${suggestion}`));
            });
        }
        // Show technical details if available
        this.handleError(error, context);
    }
    /**
     * Handle API errors with specific response analysis
     */
    handleApiError(error, context) {
        const status = error?.response?.status || error?.status;
        const statusText = error?.response?.statusText || error?.statusText;
        const responseData = error?.response?.data || error?.data;
        let friendlyMessage = `API Error: ${context.operation} failed`;
        switch (status) {
            case 400:
                friendlyMessage = 'Invalid request - check your input parameters';
                break;
            case 401:
                friendlyMessage = 'Authentication required - device may require authorization';
                break;
            case 403:
                friendlyMessage = 'Access forbidden - device denied the operation';
                break;
            case 404:
                friendlyMessage = 'Feature not available on this device';
                break;
            case 408:
                friendlyMessage = 'Request timed out - device may be busy';
                break;
            case 429:
                friendlyMessage = 'Too many requests - please wait before trying again';
                break;
            case 500:
                friendlyMessage = 'Device internal error - try restarting the device';
                break;
            case 503:
                friendlyMessage = 'Device temporarily unavailable - try again later';
                break;
            default:
                if (status) {
                    friendlyMessage = `HTTP ${status}: ${statusText || 'Unknown error'}`;
                }
        }
        this.uiHelpers.displayError(friendlyMessage);
        // Show API response details if available
        if (responseData && typeof responseData === 'object') {
            console.log(chalk.gray('\n📄 API Response:'));
            if (responseData.message) {
                console.log(chalk.gray(`Message: ${responseData.message}`));
            }
            if (responseData.error) {
                console.log(chalk.gray(`Error: ${responseData.error}`));
            }
            if (responseData.details) {
                console.log(chalk.gray(`Details: ${JSON.stringify(responseData.details, null, 2)}`));
            }
        }
    }
    /**
     * Handle validation errors with field-specific guidance
     */
    handleValidationError(error, context) {
        const message = error?.message || 'Validation failed';
        const field = error?.field;
        const value = error?.value;
        let friendlyMessage = `Invalid input: ${message}`;
        if (field) {
            friendlyMessage = `Invalid ${field}: ${message}`;
        }
        this.uiHelpers.displayError(friendlyMessage);
        if (field && value !== undefined) {
            console.log(chalk.gray(`\n📝 Field: ${field}`));
            console.log(chalk.gray(`Value: ${value}`));
        }
    }
    /**
     * Create a wrapped version of an async function with enhanced error handling
     */
    wrapWithErrorHandling(fn, context) {
        return async (...args) => {
            try {
                return await fn(...args);
            }
            catch (error) {
                this.handleError(error, context);
                throw error;
            }
        };
    }
    getFriendlyErrorMessage(error, context) {
        const message = error?.message || 'Unknown error';
        const operation = context.operation.toLowerCase();
        // Common error patterns and their friendly messages
        if (message.includes('fetch') && message.includes('failed')) {
            return `Failed to ${operation} - check device connection`;
        }
        if (message.includes('timeout')) {
            return `${context.operation} timed out - device may be busy`;
        }
        if (message.includes('permission') || message.includes('forbidden')) {
            return `${context.operation} not allowed - check device permissions`;
        }
        if (message.includes('not found') || message.includes('404')) {
            return `${context.operation} failed - feature may not be available`;
        }
        if (message.includes('network') || message.includes('connection')) {
            return `Network error during ${operation}`;
        }
        // Return original message if no pattern matches
        return `${context.operation} failed: ${message}`;
    }
    extractTechnicalDetails(error) {
        const details = {};
        if (error?.stack) {
            details.stack = error.stack.split('\n').slice(0, 5).join('\n'); // First 5 lines
        }
        if (error?.response) {
            details.response = {
                status: error.response.status,
                statusText: error.response.statusText,
                headers: error.response.headers
            };
        }
        if (error?.config) {
            details.request = {
                method: error.config.method,
                url: error.config.url,
                timeout: error.config.timeout
            };
        }
        return Object.keys(details).length > 0 ? details : null;
    }
    shouldRetry(error, retryableErrors) {
        if (!retryableErrors || retryableErrors.length === 0) {
            // Default retryable conditions
            const message = error?.message?.toLowerCase() || '';
            const code = error?.code || error?.errno;
            const status = error?.response?.status || error?.status;
            // Network-related errors that are often transient
            const networkErrors = ['ETIMEDOUT', 'ECONNRESET', 'ECONNABORTED', 'ENOTFOUND'];
            if (networkErrors.includes(code)) {
                return true;
            }
            // HTTP status codes that indicate transient issues
            const retryableStatuses = [408, 429, 500, 502, 503, 504];
            if (retryableStatuses.includes(status)) {
                return true;
            }
            // Message patterns that indicate transient issues
            if (message.includes('timeout') || message.includes('temporary') || message.includes('busy')) {
                return true;
            }
            return false;
        }
        // Check against custom retryable errors
        const errorString = error?.toString() || error?.message || '';
        return retryableErrors.some(pattern => errorString.includes(pattern));
    }
}
//# sourceMappingURL=ErrorHandler.js.map
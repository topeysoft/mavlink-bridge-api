/**
 * MAVLink Parameter Management Client with SSE Integration
 */

import { HttpClient } from '../../core/HttpClient';
import {
  ParameterValue,
  ParameterRequest,
  ParameterSetRequest,
  ParameterListRequest,
  ParameterResponse,
  ParameterChangeEvent,
  ParameterStreamOptions,
  ParameterCache,
  ParameterStats,
  ParameterSearchOptions,
  ParameterSearchResult,
  ParameterListener,
  ParameterError,
  ParameterValidationError,
  ParameterNotFoundError,
  ParameterTimeoutError,
  DEFAULT_PARAMETER_TIMEOUT,
  DEFAULT_STREAM_RECONNECT_DELAY,
  DEFAULT_MAX_RECONNECT_ATTEMPTS
} from './ParameterTypes';
import { ParameterValidator } from './ParameterValidation';
import { getParameterDefinition, searchParameters } from './ParameterDefinitions';

export class MAVLinkParameterClient {
  private httpClient: HttpClient;
  private eventSource: EventSource | null = null;
  private cache: ParameterCache;
  private listeners: Set<ParameterListener> = new Set();
  private streamOptions: ParameterStreamOptions;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(httpClient: HttpClient, streamOptions: ParameterStreamOptions = {}) {
    this.httpClient = httpClient;
    this.streamOptions = {
      autoReconnect: true,
      reconnectDelay: DEFAULT_STREAM_RECONNECT_DELAY,
      maxReconnectAttempts: DEFAULT_MAX_RECONNECT_ATTEMPTS,
      ...streamOptions
    };
    
    this.cache = {
      parameters: new Map(),
      lastUpdated: 0,
      isComplete: false
    };
  }

  /**
   * Start parameter streaming via SSE
   */
  async startParameterStream(): Promise<void> {
    if (this.eventSource) {
      this.stopParameterStream();
    }

    try {
      const baseUrl = this.httpClient.getBaseUrl();
      const streamUrl = `${baseUrl}/api/mavlink/parameters/stream`;
      
      this.eventSource = new EventSource(streamUrl);
      
      this.eventSource.onopen = () => {
        console.log('📡 Parameter stream connected');
        this.reconnectAttempts = 0;
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleParameterEvent(data);
        } catch (error) {
          console.error('❌ Failed to parse parameter event:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('❌ Parameter stream error:', error);
        
        if (this.streamOptions.autoReconnect && 
            this.reconnectAttempts < (this.streamOptions.maxReconnectAttempts || DEFAULT_MAX_RECONNECT_ATTEMPTS)) {
          this.scheduleReconnect();
        }
      };

    } catch (error) {
      throw new ParameterError(`Failed to start parameter stream: ${error}`);
    }
  }

  /**
   * Stop parameter streaming
   */
  stopParameterStream(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      console.log('📡 Parameter stream disconnected');
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Request a specific parameter by name
   */
  async requestParameter(parameterName: string, options: Partial<ParameterRequest> = {}): Promise<ParameterResponse> {
    const request: ParameterRequest = {
      parameterName,
      targetSystem: 1,
      targetComponent: 1,
      ...options
    };

    try {
      const response = await this.httpClient.post<ParameterResponse>(
        '/api/mavlink/parameters/request',
        request
      );
      return response;
    } catch (error) {
      throw new ParameterError(`Failed to request parameter ${parameterName}: ${error}`);
    }
  }

  /**
   * Request parameter by index
   */
  async requestParameterByIndex(parameterIndex: number, options: Partial<ParameterRequest> = {}): Promise<ParameterResponse> {
    const request: ParameterRequest = {
      parameterIndex,
      targetSystem: 1,
      targetComponent: 1,
      ...options
    };

    try {
      const response = await this.httpClient.post<ParameterResponse>(
        '/api/mavlink/parameters/request',
        request
      );
      return response;
    } catch (error) {
      throw new ParameterError(`Failed to request parameter at index ${parameterIndex}: ${error}`);
    }
  }

  /**
   * Set a parameter value with validation
   */
  async setParameter(parameterName: string, value: number, options: Partial<ParameterSetRequest> = {}): Promise<ParameterResponse> {
    // Client-side validation
    const validation = ParameterValidator.validateParameter(parameterName, value);
    if (!validation.valid) {
      throw new ParameterValidationError(
        `Parameter validation failed: ${validation.errors.join(', ')}`,
        parameterName,
        value,
        validation.errors
      );
    }

    const request: ParameterSetRequest = {
      parameterName,
      value: validation.normalizedValue !== undefined ? validation.normalizedValue : value,
      targetSystem: 1,
      targetComponent: 1,
      ...options
    };

    try {
      const response = await this.httpClient.post<ParameterResponse>(
        '/api/mavlink/parameters/set',
        request
      );

      // Update cache if successful
      if (response.success && response.parameterName && response.value !== undefined) {
        this.updateCacheParameter(response.parameterName, response.value);
      }

      return response;
    } catch (error) {
      throw new ParameterError(`Failed to set parameter ${parameterName}: ${error}`);
    }
  }

  /**
   * Request the complete parameter list from flight controller
   */
  async requestParameterList(options: Partial<ParameterListRequest> = {}): Promise<ParameterResponse> {
    const request: ParameterListRequest = {
      targetSystem: 1,
      targetComponent: 1,
      ...options
    };

    try {
      const response = await this.httpClient.post<ParameterResponse>(
        '/api/mavlink/parameters/list',
        request
      );
      return response;
    } catch (error) {
      throw new ParameterError(`Failed to request parameter list: ${error}`);
    }
  }

  /**
   * Get parameter value from cache
   */
  getParameterFromCache(parameterName: string): ParameterValue | undefined {
    return this.cache.parameters.get(parameterName);
  }

  /**
   * Get all cached parameters
   */
  getAllCachedParameters(): ParameterValue[] {
    return Array.from(this.cache.parameters.values());
  }

  /**
   * Search parameters using client-side filtering
   */
  searchCachedParameters(options: ParameterSearchOptions): ParameterSearchResult {
    let results = this.getAllCachedParameters();

    // Filter by query (name, display name, description)
    if (options.query) {
      const definitionResults = searchParameters(options.query);
      const definitionNames = new Set(definitionResults.map(d => d.name));
      results = results.filter(p => definitionNames.has(p.name));
    }

    // Filter by categories
    if (options.categories && options.categories.length > 0) {
      results = results.filter(p => {
        const def = getParameterDefinition(p.name);
        return def && options.categories!.includes(def.category);
      });
    }

    // Filter by user levels
    if (options.userLevels && options.userLevels.length > 0) {
      results = results.filter(p => {
        const def = getParameterDefinition(p.name);
        return def && options.userLevels!.includes(def.userLevel);
      });
    }

    // Filter by data types
    if (options.dataTypes && options.dataTypes.length > 0) {
      results = results.filter(p => {
        const def = getParameterDefinition(p.name);
        return def && options.dataTypes!.includes(def.dataType);
      });
    }

    // Apply limit and offset
    const totalCount = results.length;
    const offset = options.offset || 0;
    const limit = options.limit || totalCount;
    
    results = results.slice(offset, offset + limit);

    return {
      parameters: results,
      totalCount,
      hasMore: offset + results.length < totalCount
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): ParameterStats {
    const parameters = this.getAllCachedParameters();
    const categoryCounts: Record<string, number> = {};
    const userLevelCounts: Record<string, number> = { Standard: 0, Advanced: 0, Expert: 0 };
    const dataTypeCounts: Record<string, number> = { int: 0, float: 0, enum: 0, bitmask: 0 };
    
    let modifiedParameters = 0;

    parameters.forEach(param => {
      const def = getParameterDefinition(param.name);
      if (def) {
        categoryCounts[def.category] = (categoryCounts[def.category] || 0) + 1;
        userLevelCounts[def.userLevel]++;
        dataTypeCounts[def.dataType]++;
      }
    });

    return {
      totalParameters: parameters.length,
      modifiedParameters,
      categoryCounts,
      userLevelCounts: userLevelCounts as Record<'Standard' | 'Advanced' | 'Expert', number>,
      dataTypeCounts: dataTypeCounts as Record<'int' | 'float' | 'enum' | 'bitmask', number>,
      lastUpdate: this.cache.lastUpdated
    };
  }

  /**
   * Clear parameter cache
   */
  clearCache(): void {
    this.cache.parameters.clear();
    this.cache.lastUpdated = 0;
    this.cache.isComplete = false;
    delete this.cache.totalCount;
  }

  /**
   * Add parameter change listener
   */
  addParameterListener(listener: ParameterListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove parameter change listener
   */
  removeParameterListener(listener: ParameterListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Wait for a specific parameter to be received
   */
  async waitForParameter(parameterName: string, timeout: number = DEFAULT_PARAMETER_TIMEOUT): Promise<ParameterValue> {
    // Check cache first
    const cached = this.getParameterFromCache(parameterName);
    if (cached) {
      return cached;
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.removeParameterListener(listener);
        reject(new ParameterTimeoutError('waitForParameter', parameterName));
      }, timeout);

      const listener: ParameterListener = (event) => {
        if (event.type === 'parameter_changed' && event.parameterName === parameterName) {
          clearTimeout(timeoutId);
          this.removeParameterListener(listener);
          const parameter = this.getParameterFromCache(parameterName);
          if (parameter) {
            resolve(parameter);
          } else {
            reject(new ParameterNotFoundError(parameterName));
          }
        }
      };

      this.addParameterListener(listener);
    });
  }

  /**
   * Handle parameter events from SSE stream
   */
  private handleParameterEvent(data: any): void {
    switch (data.type) {
      case 'connected':
        console.log('✅ Parameter stream connected');
        break;

      case 'parameter_value':
        this.handleParameterValue(data);
        break;

      case 'parameter_changed':
        this.handleParameterChanged(data);
        break;

      case 'error':
        console.error('❌ Parameter stream error:', data.message);
        break;

      default:
        console.log('📡 Unknown parameter event:', data.type);
    }
  }

  /**
   * Handle parameter value event
   */
  private handleParameterValue(data: any): void {
    if (!data.parameterName || data.value === undefined) {
      return;
    }

    const parameter: ParameterValue = {
      name: data.parameterName,
      value: data.value,
      type: data.type || 'float',
      timestamp: data.timestamp || Date.now()
    };

    this.updateCacheParameter(parameter.name, parameter.value, parameter.type, parameter.timestamp);

    // Notify listeners
    const event: ParameterChangeEvent = {
      type: 'parameter_changed',
      parameterName: parameter.name,
      newValue: parameter.value,
      timestamp: parameter.timestamp!
    };

    this.notifyListeners(event);
  }

  /**
   * Handle parameter changed event
   */
  private handleParameterChanged(data: any): void {
    const event: ParameterChangeEvent = {
      type: 'parameter_changed',
      parameterName: data.parameterName,
      oldValue: data.oldValue,
      newValue: data.newValue,
      timestamp: data.timestamp || Date.now()
    };

    if (data.newValue !== undefined) {
      this.updateCacheParameter(data.parameterName, data.newValue, data.type, event.timestamp);
    }

    this.notifyListeners(event);
  }

  /**
   * Update parameter in cache
   */
  private updateCacheParameter(name: string, value: number, type: string = 'float', timestamp?: number): void {
    const parameter: ParameterValue = {
      name,
      value,
      type: type as any,
      timestamp: timestamp || Date.now()
    } as ParameterValue;

    this.cache.parameters.set(name, parameter);
    this.cache.lastUpdated = Date.now();
  }

  /**
   * Notify all listeners of parameter change
   */
  private notifyListeners(event: ParameterChangeEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('❌ Error in parameter listener:', error);
      }
    });
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    const delay = (this.streamOptions.reconnectDelay || DEFAULT_STREAM_RECONNECT_DELAY) * this.reconnectAttempts;

    console.log(`🔄 Scheduling parameter stream reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.startParameterStream().catch(error => {
        console.error('❌ Failed to reconnect parameter stream:', error);
      });
    }, delay);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopParameterStream();
    this.listeners.clear();
    this.clearCache();
  }
}
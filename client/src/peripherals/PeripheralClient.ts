/**
 * Peripheral Client
 *
 * API client for peripheral management endpoints
 */

import { HttpClient } from '../core/HttpClient';
import {
  Peripheral,
  PeripheralListResponse,
  PeripheralMetadata,
  PeripheralOperationResponse,
  PeripheralCommandRequest,
  PeripheralTelemetry,
  CompatibilityCheckResponse,
  PeripheralStats,
  PeripheralType
} from './PeripheralTypes';

export class PeripheralClient {
  constructor(private httpClient: HttpClient) {}

  /**
   * List all peripherals
   * @param peripheralType Optional filter by peripheral type
   * @returns List of peripherals with counts
   */
  async listPeripherals(peripheralType?: PeripheralType): Promise<PeripheralListResponse> {
    let url = '/api/peripherals';
    if (peripheralType) {
      url += `?peripheral_type=${peripheralType}`;
    }
    return this.httpClient.get<PeripheralListResponse>(url);
  }

  /**
   * Get peripheral statistics
   * @returns Statistics about peripherals
   */
  async getStats(): Promise<PeripheralStats> {
    return this.httpClient.get<PeripheralStats>('/api/peripherals/stats');
  }

  /**
   * Check peripheral compatibility
   * @returns Compatibility check response with conflicts and warnings
   */
  async checkCompatibility(): Promise<CompatibilityCheckResponse> {
    return this.httpClient.get<CompatibilityCheckResponse>('/api/peripherals/compatibility/check');
  }

  /**
   * Register a new peripheral
   * @param metadata Peripheral metadata
   * @returns Operation response
   */
  async registerPeripheral(metadata: PeripheralMetadata): Promise<PeripheralOperationResponse> {
    return this.httpClient.post<PeripheralOperationResponse>('/api/peripherals', metadata);
  }

  /**
   * Get peripheral details
   * @param peripheralId Peripheral identifier
   * @returns Peripheral object
   */
  async getPeripheral(peripheralId: string): Promise<Peripheral> {
    return this.httpClient.get<Peripheral>(`/api/peripherals/${peripheralId}`);
  }

  /**
   * Unregister a peripheral
   * @param peripheralId Peripheral identifier
   * @returns Operation response
   */
  async unregisterPeripheral(peripheralId: string): Promise<PeripheralOperationResponse> {
    return this.httpClient.delete<PeripheralOperationResponse>(`/api/peripherals/${peripheralId}`);
  }

  /**
   * Get peripheral status
   * @param peripheralId Peripheral identifier
   * @returns Status object
   */
  async getPeripheralStatus(peripheralId: string): Promise<Record<string, any>> {
    return this.httpClient.get<Record<string, any>>(`/api/peripherals/${peripheralId}/status`);
  }

  /**
   * Get peripheral telemetry
   * @param peripheralId Peripheral identifier
   * @returns Telemetry data
   */
  async getPeripheralTelemetry(peripheralId: string): Promise<PeripheralTelemetry> {
    return this.httpClient.get<PeripheralTelemetry>(`/api/peripherals/${peripheralId}/telemetry`);
  }

  /**
   * Enable a peripheral
   * @param peripheralId Peripheral identifier
   * @returns Operation response
   */
  async enablePeripheral(peripheralId: string): Promise<PeripheralOperationResponse> {
    return this.httpClient.post<PeripheralOperationResponse>(
      `/api/peripherals/${peripheralId}/enable`,
      {}
    );
  }

  /**
   * Disable a peripheral
   * @param peripheralId Peripheral identifier
   * @returns Operation response
   */
  async disablePeripheral(peripheralId: string): Promise<PeripheralOperationResponse> {
    return this.httpClient.post<PeripheralOperationResponse>(
      `/api/peripherals/${peripheralId}/disable`,
      {}
    );
  }

  /**
   * Send command to peripheral
   * @param peripheralId Peripheral identifier
   * @param command Command and parameters
   * @returns Operation response
   */
  async sendCommand(
    peripheralId: string,
    command: PeripheralCommandRequest
  ): Promise<PeripheralOperationResponse> {
    return this.httpClient.post<PeripheralOperationResponse>(
      `/api/peripherals/${peripheralId}/command`,
      command
    );
  }
}

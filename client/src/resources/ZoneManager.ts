/**
 * ZoneManager - Manages zone resources with server sync
 */

import { ResourceManager } from './ResourceManager';
import { EventType } from '../core/EventTypes';
import type { Zone, ResourceType, ResourceMetadata, ResourceListResponse } from './ResourceTypes';
import type { HttpClient } from '../core/HttpClient';

export class ZoneManager extends ResourceManager<Zone> {
  constructor(httpClient: HttpClient, config = {}) {
    super(httpClient, config);
  }

  protected getStoreName(): string {
    return 'zones';
  }

  protected getResourceType(): ResourceType {
    return 0; // ResourceType.ZONE
  }

  protected getApiPath(): string {
    return '/api/zones';
  }

  protected getWebSocketEventTypes() {
    return {
      created: EventType.ZONE_CREATED,
      updated: EventType.ZONE_UPDATED,
      deleted: EventType.ZONE_DELETED
    };
  }

  protected extractMetadataFromResponse(response: ResourceListResponse): ResourceMetadata[] {
    return response.zones || [];
  }

  /**
   * Get zones filtered by type
   */
  async getByType(type: Zone['type']): Promise<Zone[]> {
    const all = await this.getAll();
    return all.filter(zone => zone.type === type);
  }

  /**
   * Get zones by tags
   */
  async getByTags(tags: string[]): Promise<Zone[]> {
    const all = await this.getAll();
    return all.filter(zone =>
      zone.tags && tags.some(tag => zone.tags?.includes(tag))
    );
  }

  /**
   * Calculate total area of all zones
   */
  async getTotalArea(): Promise<number> {
    const zones = await this.getAll();
    return zones.reduce((sum, zone) => sum + zone.area, 0);
  }

  /**
   * Get zones within a bounding box
   */
  async getZonesInBounds(
    minLat: number,
    maxLat: number,
    minLng: number,
    maxLng: number
  ): Promise<Zone[]> {
    const all = await this.getAll();
    return all.filter(zone =>
      zone.coordinates.some(([lat, lng]) =>
        lat >= minLat && lat <= maxLat &&
        lng >= minLng && lng <= maxLng
      )
    );
  }
}

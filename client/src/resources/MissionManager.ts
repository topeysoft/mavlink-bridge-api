/**
 * MissionManager - Manages mission resources with server sync
 */

import { ResourceManager } from './ResourceManager';
import { EventType } from '../core/EventTypes';
import type { Mission, ResourceType, ResourceMetadata, ResourceListResponse } from './ResourceTypes';
import type { HttpClient } from '../core/HttpClient';

export class MissionManager extends ResourceManager<Mission> {
  constructor(httpClient: HttpClient, config = {}) {
    super(httpClient, config);
  }

  protected getStoreName(): string {
    return 'missions';
  }

  protected getResourceType(): ResourceType {
    return 1; // ResourceType.MISSION
  }

  protected getApiPath(): string {
    return '/api/missions';
  }

  protected getWebSocketEventTypes() {
    return {
      created: EventType.MISSION_CREATED,
      updated: EventType.MISSION_UPDATED,
      deleted: EventType.MISSION_DELETED
    };
  }

  protected extractMetadataFromResponse(response: ResourceListResponse): ResourceMetadata[] {
    return response.missions || [];
  }

  /**
   * Get missions scheduled for a specific date
   */
  async getMissionsForDate(date: Date): Promise<Mission[]> {
    const all = await this.getAll();
    const dateStr = date.toISOString().split('T')[0];

    return all.filter(mission => {
      const startDate = new Date(mission.schedule.startTime);
      const startDateStr = startDate.toISOString().split('T')[0];

      if (mission.type === 'once') {
        return startDateStr === dateStr;
      }

      if (mission.type === 'weekly' && mission.schedule.daysOfWeek) {
        const dayOfWeek = date.getDay(); // 0=Sunday, 6=Saturday
        return mission.schedule.daysOfWeek.includes(dayOfWeek);
      }

      if (mission.type === 'monthly' && mission.schedule.dayOfMonth) {
        return date.getDate() === mission.schedule.dayOfMonth;
      }

      if (mission.type === 'daily') {
        return true; // Daily missions match every day
      }

      return false;
    });
  }

  /**
   * Get missions using a specific zone
   */
  async getMissionsUsingZone(zoneId: string): Promise<Mission[]> {
    const all = await this.getAll();
    return all.filter(mission => mission.zoneIds.includes(zoneId));
  }

  /**
   * Get upcoming missions (next N days)
   */
  async getUpcomingMissions(days: number = 7): Promise<Mission[]> {
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + days);

    const all = await this.getAll();

    return all.filter(mission => {
      if (!mission.enabled) return false;

      const startDate = new Date(mission.schedule.startTime);

      if (mission.type === 'once') {
        return startDate >= now && startDate <= future;
      }

      // For recurring missions (daily/weekly/monthly), return if enabled
      return true;
    });
  }

  /**
   * Get enabled missions
   */
  async getEnabledMissions(): Promise<Mission[]> {
    const all = await this.getAll();
    return all.filter(mission => mission.enabled);
  }

  /**
   * Get missions by type
   */
  async getByType(type: 'once' | 'daily' | 'weekly' | 'monthly'): Promise<Mission[]> {
    const all = await this.getAll();
    return all.filter(mission => mission.type === type);
  }

  /**
   * Get missions by priority
   */
  async getByPriority(priority: 'low' | 'normal' | 'high' | 'critical'): Promise<Mission[]> {
    const all = await this.getAll();
    return all.filter(mission => mission.priority === priority);
  }
}

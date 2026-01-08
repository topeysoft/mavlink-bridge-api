/**
 * MissionExecutor - Converts zones to MAVLink waypoints and executes missions
 */

import type { Zone, Mission } from './ResourceTypes';
import type { ZoneManager } from './ZoneManager';
import type { MissionManager } from './MissionManager';
import type { MAVLinkMissionClient } from '../mavlink/MAVLinkMissionClient';
import type { MissionItem, MissionPlan } from '../mavlink/MAVLinkMissionTypes';
import { MAVFrame, MAVMissionType } from '../mavlink/MAVLinkMissionTypes';

export interface WaypointGenerationOptions {
  altitude: number;
  speed?: number;
  spacing?: number; // meters between passes
  pattern?: 'parallel' | 'spiral' | 'perimeter';
  heading?: number; // degrees for parallel pattern orientation
}

export interface MissionExecutionOptions {
  targetSystem?: number;
  targetComponent?: number;
  validateBeforeUpload?: boolean;
}

export interface MissionExecutionResult {
  success: boolean;
  waypointsGenerated: number;
  waypointsUploaded: number;
  error?: string;
}

/**
 * MAVLink NAV commands
 */
export enum MAV_CMD {
  NAV_WAYPOINT = 16,
  NAV_LOITER_UNLIM = 17,
  NAV_LOITER_TURNS = 18,
  NAV_LOITER_TIME = 19,
  NAV_RETURN_TO_LAUNCH = 20,
  NAV_LAND = 21,
  NAV_TAKEOFF = 22,
  NAV_SPLINE_WAYPOINT = 82,
  DO_CHANGE_SPEED = 178,
  DO_SET_HOME = 179
}

export class MissionExecutor {
  constructor(
    private zoneManager: ZoneManager,
    private missionManager: MissionManager,
    private mavlinkMissionClient: MAVLinkMissionClient
  ) {}

  /**
   * Generate waypoints from a zone polygon using specified pattern
   */
  async generateWaypointsFromZone(
    zone: Zone,
    options: WaypointGenerationOptions
  ): Promise<MissionItem[]> {
    const pattern = options.pattern || 'parallel';

    switch (pattern) {
      case 'parallel':
        return this.generateParallelPattern(zone, options);
      case 'spiral':
        return this.generateSpiralPattern(zone, options);
      case 'perimeter':
        return this.generatePerimeterPattern(zone, options);
      default:
        throw new Error(`Unknown pattern: ${pattern}`);
    }
  }

  /**
   * Generate full mission plan from a scheduled mission
   */
  async buildMissionPlan(
    mission: Mission,
    options: Partial<WaypointGenerationOptions> = {}
  ): Promise<MissionPlan> {
    const items: MissionItem[] = [];
    let seq = 0;

    // Fetch all zones for this mission
    const zones: Zone[] = [];
    for (const zoneId of mission.zoneIds) {
      const zone = await this.zoneManager.getById(zoneId);
      if (zone) {
        zones.push(zone);
      }
    }

    if (zones.length === 0) {
      throw new Error('No valid zones found for mission');
    }

    // Generate waypoints for each zone
    for (const zone of zones) {
      // Use zone-specific settings if available, otherwise use defaults
      // Handle zone pattern (convert 'random' to 'spiral' since it's not supported in waypoint generation)
      const zonePattern = zone.settings?.pattern;
      const pattern: 'parallel' | 'spiral' | 'perimeter' =
        zonePattern === 'random' ? 'spiral' : (zonePattern || options.pattern || 'parallel');

      const zoneOptions: WaypointGenerationOptions = {
        altitude: options.altitude || 5,
        speed: options.speed || zone.settings?.speed || 2,
        spacing: options.spacing || zone.settings?.overlap || 3,
        pattern
      };
      if (options.heading !== undefined) {
        zoneOptions.heading = options.heading;
      }

      const zoneWaypoints = await this.generateWaypointsFromZone(zone, zoneOptions);

      // Update sequence numbers
      for (const wp of zoneWaypoints) {
        wp.seq = seq++;
        items.push(wp);
      }
    }

    // Add RTL (Return to Launch) at the end
    items.push(this.createRTLWaypoint(seq));

    // Mark first waypoint as current
    if (items.length > 0 && items[0]) {
      items[0].current = 1;
    }

    return {
      items,
      targetSystem: 1,
      targetComponent: 1
    };
  }

  /**
   * Execute a mission: fetch zones, generate waypoints, upload to FC
   */
  async executeMission(
    missionId: string,
    options: MissionExecutionOptions = {}
  ): Promise<MissionExecutionResult> {
    try {
      // Fetch mission from server
      const mission = await this.missionManager.getById(missionId);
      if (!mission) {
        throw new Error(`Mission ${missionId} not found`);
      }

      // Build mission plan
      const missionPlan = await this.buildMissionPlan(mission);

      // Validate if requested
      if (options.validateBeforeUpload !== false) {
        this.validateMissionPlan(missionPlan);
      }

      // Upload to flight controller
      const uploadOptions: any = {
        missionType: MAVMissionType.MAV_MISSION_TYPE_MISSION
      };
      if (options.targetSystem !== undefined) uploadOptions.targetSystem = options.targetSystem;
      if (options.targetComponent !== undefined) uploadOptions.targetComponent = options.targetComponent;

      const result = await this.mavlinkMissionClient.uploadMission(missionPlan, uploadOptions);

      const executionResult: MissionExecutionResult = {
        success: result.success,
        waypointsGenerated: missionPlan.items.length,
        waypointsUploaded: result.itemsProcessed || 0
      };
      if (result.errorMessage) {
        executionResult.error = result.errorMessage;
      }
      return executionResult;
    } catch (error) {
      return {
        success: false,
        waypointsGenerated: 0,
        waypointsUploaded: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate parallel (lawnmower) pattern waypoints
   */
  private generateParallelPattern(
    zone: Zone,
    options: WaypointGenerationOptions
  ): MissionItem[] {
    const items: MissionItem[] = [];
    const coords = zone.coordinates;

    if (coords.length < 3) {
      throw new Error('Zone must have at least 3 coordinates');
    }

    // Calculate bounding box
    const bounds = this.calculateBounds(coords);
    const heading = options.heading || 0; // 0 = North-South passes

    // Calculate number of passes based on spacing
    const spacing = options.spacing || 3; // meters
    const width = this.calculateDistance(
      bounds.minLat, bounds.minLng,
      bounds.minLat, bounds.maxLng
    );
    const numPasses = Math.ceil(width / spacing);

    // Generate back-and-forth passes
    let direction = 1; // 1 = forward, -1 = backward
    for (let i = 0; i <= numPasses; i++) {
      const progress = i / numPasses;
      const lng = bounds.minLng + (bounds.maxLng - bounds.minLng) * progress;

      const lat = direction === 1 ? bounds.minLat : bounds.maxLat;
      const endLat = direction === 1 ? bounds.maxLat : bounds.minLat;

      // Start point
      items.push(this.createWaypoint(lat, lng, options.altitude, options.speed));

      // End point
      items.push(this.createWaypoint(endLat, lng, options.altitude, options.speed));

      direction *= -1; // Reverse direction for next pass
    }

    return items;
  }

  /**
   * Generate spiral (inside-out) pattern waypoints
   */
  private generateSpiralPattern(
    zone: Zone,
    options: WaypointGenerationOptions
  ): MissionItem[] {
    const items: MissionItem[] = [];
    const coords = zone.coordinates;

    // Calculate centroid
    const center = this.calculateCentroid(coords);

    // Start from perimeter and spiral inward
    const spacing = options.spacing || 3; // meters
    const bounds = this.calculateBounds(coords);
    const maxRadius = this.calculateDistance(
      center.lat, center.lng,
      bounds.maxLat, bounds.maxLng
    );

    let radius = maxRadius;
    const numCircles = Math.ceil(maxRadius / spacing);
    const pointsPerCircle = 16; // 16 waypoints per circle

    while (radius > spacing) {
      for (let i = 0; i < pointsPerCircle; i++) {
        const angle = (i / pointsPerCircle) * 2 * Math.PI;
        const lat = center.lat + (radius / 111320) * Math.cos(angle);
        const lng = center.lng + (radius / (111320 * Math.cos(center.lat * Math.PI / 180))) * Math.sin(angle);

        items.push(this.createWaypoint(lat, lng, options.altitude, options.speed));
      }
      radius -= spacing;
    }

    return items;
  }

  /**
   * Generate perimeter pattern waypoints (follow zone boundary)
   */
  private generatePerimeterPattern(
    zone: Zone,
    options: WaypointGenerationOptions
  ): MissionItem[] {
    const items: MissionItem[] = [];

    // Follow zone perimeter
    for (const [lng, lat] of zone.coordinates) {
      items.push(this.createWaypoint(lat, lng, options.altitude, options.speed));
    }

    // Close the loop
    const firstCoord = zone.coordinates[0];
    if (firstCoord) {
      const [lng, lat] = firstCoord;
      items.push(this.createWaypoint(lat, lng, options.altitude, options.speed));
    }

    return items;
  }

  /**
   * Create a waypoint mission item
   */
  private createWaypoint(
    lat: number,
    lng: number,
    alt: number,
    speed?: number
  ): MissionItem {
    return {
      seq: 0, // Will be set by caller
      frame: MAVFrame.MAV_FRAME_GLOBAL_RELATIVE_ALT_INT,
      command: MAV_CMD.NAV_WAYPOINT,
      current: 0,
      autocontinue: 1,
      param1: 0, // Hold time (seconds)
      param2: 2, // Acceptance radius (meters)
      param3: 0, // Pass radius
      param4: NaN, // Yaw angle (NaN = don't change)
      x: Math.round(lat * 1e7), // Latitude * 1e7
      y: Math.round(lng * 1e7), // Longitude * 1e7
      z: alt,
      missionType: MAVMissionType.MAV_MISSION_TYPE_MISSION
    };
  }

  /**
   * Create RTL (Return to Launch) waypoint
   */
  private createRTLWaypoint(seq: number): MissionItem {
    return {
      seq,
      frame: MAVFrame.MAV_FRAME_GLOBAL_RELATIVE_ALT,
      command: MAV_CMD.NAV_RETURN_TO_LAUNCH,
      current: 0,
      autocontinue: 1,
      param1: 0,
      param2: 0,
      param3: 0,
      param4: 0,
      x: 0,
      y: 0,
      z: 0,
      missionType: MAVMissionType.MAV_MISSION_TYPE_MISSION
    };
  }

  /**
   * Calculate bounding box for coordinates
   */
  private calculateBounds(coords: Array<[number, number]>) {
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    for (const [lng, lat] of coords) {
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    }

    return { minLat, maxLat, minLng, maxLng };
  }

  /**
   * Calculate centroid of polygon
   */
  private calculateCentroid(coords: Array<[number, number]>): { lat: number; lng: number } {
    let sumLat = 0;
    let sumLng = 0;

    for (const [lng, lat] of coords) {
      sumLat += lat;
      sumLng += lng;
    }

    return {
      lat: sumLat / coords.length,
      lng: sumLng / coords.length
    };
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Validate mission plan before upload
   */
  private validateMissionPlan(plan: MissionPlan): void {
    if (plan.items.length === 0) {
      throw new Error('Mission plan has no waypoints');
    }

    if (plan.items.length > 255) {
      throw new Error('Mission plan exceeds maximum waypoint limit (255)');
    }

    // Check for valid coordinates
    for (const item of plan.items) {
      const lat = item.x / 1e7;
      const lng = item.y / 1e7;

      if (Math.abs(lat) > 90) {
        throw new Error(`Invalid latitude: ${lat}`);
      }

      if (Math.abs(lng) > 180) {
        throw new Error(`Invalid longitude: ${lng}`);
      }
    }
  }
}

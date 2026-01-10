/**
 * Client for zone recording API
 */

import { HttpClient } from '../core/HttpClient'
import type {
  AnchorPoint,
  GPSWaypoint,
  RecordingConfig,
  RecordingSession,
  RecordingStartResponse,
  RecordingCompleteResult
} from './ZoneRecordingTypes'

export class ZoneRecordingClient {
  private http: HttpClient

  constructor(http: HttpClient) {
    this.http = http
  }

  /**
   * Start a new recording session
   * @param config Recording configuration
   * @returns Session ID
   */
  async startRecording(config?: RecordingConfig): Promise<string> {
    const response = await this.http.post<RecordingStartResponse>(
      '/api/zones/recording/start',
      config || {}
    )
    return response.session_id
  }

  /**
   * Add a GPS waypoint to the recording session
   * @param sessionId Session ID
   * @param waypoint GPS waypoint data
   */
  async addWaypoint(sessionId: string, waypoint: GPSWaypoint): Promise<void> {
    await this.http.post(
      `/api/zones/recording/${sessionId}/waypoint`,
      waypoint
    )
  }

  /**
   * Pause the recording session
   * @param sessionId Session ID
   */
  async pauseRecording(sessionId: string): Promise<void> {
    await this.http.post(`/api/zones/recording/${sessionId}/pause`)
  }

  /**
   * Resume a paused recording session
   * @param sessionId Session ID
   */
  async resumeRecording(sessionId: string): Promise<void> {
    await this.http.post(`/api/zones/recording/${sessionId}/resume`)
  }

  /**
   * Get current status of the recording session
   * @param sessionId Session ID
   * @returns Session status
   */
  async getStatus(sessionId: string): Promise<RecordingSession> {
    const response = await this.http.get<{
      session_id: string
      status: string
      mode: string
      waypoint_count: number
      anchor_count?: number
      estimated_area?: number
      estimated_perimeter?: number
      shape_type?: string
    }>(`/api/zones/recording/${sessionId}/status`)

    return {
      sessionId: response.session_id,
      status: response.status as any,
      mode: response.mode as any,
      waypointCount: response.waypoint_count,
      ...(response.anchor_count !== undefined && { anchorCount: response.anchor_count }),
      ...(response.estimated_area !== undefined && { estimatedArea: response.estimated_area }),
      ...(response.estimated_perimeter !== undefined && { estimatedPerimeter: response.estimated_perimeter }),
      ...(response.shape_type !== undefined && { shapeType: response.shape_type as any })
    }
  }

  /**
   * Complete the recording and get the processed zone
   * @param sessionId Session ID
   * @returns Completed recording result
   */
  async completeRecording(sessionId: string): Promise<RecordingCompleteResult> {
    const response = await this.http.post<{
      session_id: string
      zone_preview: any
      waypoint_count: number
      simplified_count: number
      area: number
      perimeter: number
    }>(`/api/zones/recording/${sessionId}/complete`)

    return {
      sessionId: response.session_id,
      zonePreview: response.zone_preview,
      waypointCount: response.waypoint_count,
      simplifiedCount: response.simplified_count,
      area: response.area,
      perimeter: response.perimeter
    }
  }

  /**
   * Cancel and delete a recording session
   * @param sessionId Session ID
   */
  async cancelRecording(sessionId: string): Promise<void> {
    await this.http.delete(`/api/zones/recording/${sessionId}`)
  }

  // Anchor mode methods

  /**
   * Add an anchor point to the recording session (anchor mode only)
   * @param sessionId Session ID
   * @param anchor Anchor point data
   */
  async addAnchor(sessionId: string, anchor: AnchorPoint): Promise<void> {
    await this.http.post(
      `/api/zones/recording/${sessionId}/anchor`,
      anchor
    )
  }

  /**
   * Update an existing anchor point position
   * @param sessionId Session ID
   * @param index Anchor index to update
   * @param lat New latitude
   * @param lon New longitude
   */
  async updateAnchor(sessionId: string, index: number, lat: number, lon: number): Promise<void> {
    await this.http.put(
      `/api/zones/recording/${sessionId}/anchor/${index}`,
      { lat, lon }
    )
  }

  /**
   * Remove an anchor point
   * @param sessionId Session ID
   * @param index Anchor index to remove
   */
  async removeAnchor(sessionId: string, index: number): Promise<void> {
    await this.http.delete(`/api/zones/recording/${sessionId}/anchor/${index}`)
  }
}

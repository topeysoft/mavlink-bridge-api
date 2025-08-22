import { HttpClient } from '../core/HttpClient';
import { WebSocketClient } from '../core/WebSocketClient';
import { EventType } from '../core/EventTypes';
import {
  Task,
  TaskCreateRequest,
  TaskUpdateRequest,
  TaskListResponse,
  TaskListOptions,
  TaskExecutionRequest,
  TaskExecutionResponse,
  TaskExecutionStatus,
  TaskImportRequest,
  TaskImportResponse,
  TaskExportRequest,
  TaskExportResponse,
  TaskTemplate,
  TaskTemplateListResponse,
  TaskFromTemplateRequest,
  TaskEventPayload,
  TaskType,
  TaskStatus,
  TaskPriority,
  TaskBackupFormat,
  TaskWaypoint,
  TaskParameters,
  MowingPatternOptions,
  SurveyPatternOptions,
  SpiralPatternOptions,
  PerimeterPatternOptions,
  CustomPolygonPatternOptions,
  PatternOptimizationOptions,
  createWaypoint,
  createTakeoffWaypoint,
  createLandWaypoint,
  createLoiterWaypoint,
  createReturnToLaunchWaypoint,
  createDefaultTaskParameters
} from './TaskTypes';

export class TaskClient {
  private operationInProgress = new Set<string>();
  private taskEventHandlers: Array<(event: TaskEventPayload) => void> = [];

  constructor(
    private httpClient: HttpClient,
    private wsClient?: WebSocketClient
  ) {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (!this.wsClient) return;

    // Listen for task-related events
    const taskEvents = [
      EventType.TASK_CREATED,
      EventType.TASK_UPDATED,
      EventType.TASK_DELETED,
      EventType.TASK_EXECUTION_STARTED,
      EventType.TASK_EXECUTION_PROGRESS,
      EventType.TASK_EXECUTION_PAUSED,
      EventType.TASK_EXECUTION_RESUMED,
      EventType.TASK_EXECUTION_COMPLETED,
      EventType.TASK_EXECUTION_FAILED,
      EventType.TASK_EXECUTION_CANCELLED
    ];

    taskEvents.forEach(eventType => {
      this.wsClient!.on(eventType, (data: any) => {
        const event: TaskEventPayload = {
          type: eventType as any,
          data,
          timestamp: Date.now()
        };
        this.taskEventHandlers.forEach(handler => handler(event));
      });
    });
  }

  // Task CRUD operations
  async createTask(request: TaskCreateRequest): Promise<Task> {
    const response = await this.httpClient.post<Task>('/api/tasks', request);
    return response;
  }

  async getTask(taskId: string): Promise<Task> {
    const response = await this.httpClient.get<Task>(`/api/tasks/${taskId}`);
    return response;
  }

  async updateTask(taskId: string, request: TaskUpdateRequest): Promise<Task> {
    const response = await this.httpClient.put<Task>(`/api/tasks/${taskId}`, request);
    return response;
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.httpClient.delete(`/api/tasks/${taskId}`);
  }

  async listTasks(options: TaskListOptions = {}): Promise<TaskListResponse> {
    const params = new URLSearchParams();
    
    if (options.type) params.append('type', options.type);
    if (options.status) params.append('status', options.status);
    if (options.priority) params.append('priority', options.priority);

    const queryString = params.toString();
    const url = queryString ? `/api/tasks?${queryString}` : '/api/tasks';
    
    const response = await this.httpClient.get<TaskListResponse>(url);
    return response;
  }

  // Task execution operations
  async executeTask(taskId: string, options: TaskExecutionRequest = {}): Promise<TaskExecutionResponse> {
    if (this.operationInProgress.has(taskId)) {
      throw new Error(`Task ${taskId} operation already in progress`);
    }

    this.operationInProgress.add(taskId);
    try {
      const response = await this.httpClient.post<TaskExecutionResponse>(
        `/api/tasks/${taskId}/execute`,
        options
      );
      return response;
    } finally {
      this.operationInProgress.delete(taskId);
    }
  }

  async cancelTask(taskId: string): Promise<TaskExecutionResponse> {
    const response = await this.httpClient.post<TaskExecutionResponse>(
      `/api/tasks/${taskId}/cancel`
    );
    return response;
  }

  async pauseTask(taskId: string): Promise<TaskExecutionResponse> {
    const response = await this.httpClient.post<TaskExecutionResponse>(
      `/api/tasks/${taskId}/pause`
    );
    return response;
  }

  async resumeTask(taskId: string): Promise<TaskExecutionResponse> {
    const response = await this.httpClient.post<TaskExecutionResponse>(
      `/api/tasks/${taskId}/resume`
    );
    return response;
  }

  async getTaskExecutionStatus(taskId: string): Promise<TaskExecutionStatus> {
    const response = await this.httpClient.get<TaskExecutionStatus>(
      `/api/tasks/${taskId}/status`
    );
    return response;
  }

  // Import/Export operations
  async importTasks(request: TaskImportRequest): Promise<TaskImportResponse> {
    const response = await this.httpClient.post<TaskImportResponse>('/api/tasks/import', request);
    return response;
  }

  async exportTasks(request: TaskExportRequest = {}): Promise<TaskExportResponse> {
    if (request.taskIds && request.taskIds.length > 0) {
      // Export specific tasks
      const response = await this.httpClient.post<TaskExportResponse>('/api/tasks/export', request);
      return response;
    } else {
      // Export all tasks
      const params = new URLSearchParams();
      if (request.format) params.append('format', request.format);
      if (request.includeWaypoints !== undefined) params.append('includeWaypoints', request.includeWaypoints.toString());

      const queryString = params.toString();
      const url = queryString ? `/api/tasks/export?${queryString}` : '/api/tasks/export';
      
      const response = await this.httpClient.get<TaskExportResponse>(url);
      return response;
    }
  }

  async exportAllTasks(format: TaskBackupFormat = TaskBackupFormat.JSON, includeWaypoints = true): Promise<TaskExportResponse> {
    return this.exportTasks({ format, includeWaypoints });
  }

  async exportSpecificTasks(taskIds: string[], format: TaskBackupFormat = TaskBackupFormat.JSON): Promise<TaskExportResponse> {
    return this.exportTasks({ taskIds, format, includeWaypoints: true });
  }

  // Template operations
  async getTaskTemplates(): Promise<TaskTemplateListResponse> {
    const response = await this.httpClient.get<TaskTemplateListResponse>('/api/tasks/templates');
    return response;
  }

  async createTaskFromTemplate(request: TaskFromTemplateRequest): Promise<Task> {
    const response = await this.httpClient.post<Task>('/api/tasks/templates', request);
    return response;
  }

  // Convenience methods for creating tasks
  createWaypointTask(name: string, waypoints: TaskWaypoint[], description?: string): TaskCreateRequest {
    return {
      name,
      description: description || '',
      type: TaskType.WAYPOINT_MISSION,
      priority: TaskPriority.NORMAL,
      parameters: createDefaultTaskParameters(),
      waypoints
    };
  }

  createMowingTask(name: string, pattern: MowingPatternOptions, description?: string): TaskCreateRequest {
    const waypoints = this.generateMowingPattern(pattern);
    return {
      name,
      description: description || '',
      type: TaskType.MOWING,
      priority: TaskPriority.NORMAL,
      parameters: {
        ...createDefaultTaskParameters(),
        speed: pattern.speed || 2.0,
        altitude: pattern.altitude
      },
      waypoints
    };
  }

  createSurveyTask(name: string, pattern: SurveyPatternOptions, description?: string): TaskCreateRequest {
    const waypoints = this.generateSurveyPattern(pattern);
    return {
      name,
      description: description || '',
      type: TaskType.SURVEYING,
      priority: TaskPriority.NORMAL,
      parameters: {
        ...createDefaultTaskParameters(),
        altitude: pattern.altitude
      },
      waypoints
    };
  }

  // Pattern generation methods
  generateMowingPattern(options: MowingPatternOptions): TaskWaypoint[] {
    const waypoints: TaskWaypoint[] = [];
    
    // Convert to meters (approximate)
    const metersPerDegreeLat = 111000.0;
    const metersPerDegreeLng = 111000.0 * Math.cos(options.centerLat * Math.PI / 180.0);
    
    const latStep = options.spacing / metersPerDegreeLat;
    const lngOffset = options.width / 2.0 / metersPerDegreeLng;
    
    const numPasses = Math.floor(options.height / options.spacing) + 1;
    let leftToRight = true;
    
    for (let i = 0; i < numPasses; i++) {
      const currentLat = options.centerLat - (options.height / 2.0 / metersPerDegreeLat) + (i * latStep);
      
      const startLng = leftToRight ? (options.centerLng - lngOffset) : (options.centerLng + lngOffset);
      const endLng = leftToRight ? (options.centerLng + lngOffset) : (options.centerLng - lngOffset);
      
      waypoints.push(createWaypoint({
        lat: currentLat,
        lng: startLng,
        alt: options.altitude,
        speed: options.speed || 2.0
      }));
      
      waypoints.push(createWaypoint({
        lat: currentLat,
        lng: endLng,
        alt: options.altitude,
        speed: options.speed || 2.0
      }));
      
      leftToRight = !leftToRight;
    }
    
    return waypoints;
  }

  generateSurveyPattern(options: SurveyPatternOptions): TaskWaypoint[] {
    // Enhanced survey pattern with camera overlap optimization
    const waypoints: TaskWaypoint[] = [];
    
    const metersPerDegreeLat = 111000.0;
    const metersPerDegreeLng = 111000.0 * Math.cos(options.centerLat * Math.PI / 180.0);
    
    const latStep = options.spacing / metersPerDegreeLat;
    const lngOffset = options.width / 2.0 / metersPerDegreeLng;
    
    const numPasses = Math.floor(options.height / options.spacing) + 1;
    let leftToRight = true;
    
    for (let i = 0; i < numPasses; i++) {
      const currentLat = options.centerLat - (options.height / 2.0 / metersPerDegreeLat) + (i * latStep);
      
      if (options.backAndForth || i % 2 === 0) {
        const startLng = leftToRight ? (options.centerLng - lngOffset) : (options.centerLng + lngOffset);
        const endLng = leftToRight ? (options.centerLng + lngOffset) : (options.centerLng - lngOffset);
        
        waypoints.push(createWaypoint({
          lat: currentLat,
          lng: startLng,
          alt: options.altitude,
          command: 16, // MAV_CMD_NAV_WAYPOINT
          dwellTime: 1000 // 1 second for camera capture
        }));
        
        waypoints.push(createWaypoint({
          lat: currentLat,
          lng: endLng,
          alt: options.altitude,
          command: 16,
          dwellTime: 1000
        }));
        
        leftToRight = !leftToRight;
      }
    }
    
    return waypoints;
  }

  generateSpiralPattern(options: SpiralPatternOptions): TaskWaypoint[] {
    const waypoints: TaskWaypoint[] = [];
    
    const metersPerDegreeLat = 111000.0;
    const metersPerDegreeLng = 111000.0 * Math.cos(options.centerLat * Math.PI / 180.0);
    
    const spirals = Math.floor(options.radius / options.spacing);
    const pointsPerSpiral = 20; // Adjust for smoothness
    
    for (let spiral = 0; spiral < spirals; spiral++) {
      const currentRadius = (spiral + 1) * options.spacing;
      
      for (let point = 0; point < pointsPerSpiral; point++) {
        const angle = (point / pointsPerSpiral) * 2 * Math.PI;
        const adjustedAngle = options.clockwise ? -angle : angle;
        
        const latOffset = (currentRadius * Math.cos(adjustedAngle)) / metersPerDegreeLat;
        const lngOffset = (currentRadius * Math.sin(adjustedAngle)) / metersPerDegreeLng;
        
        waypoints.push(createWaypoint({
          lat: options.centerLat + latOffset,
          lng: options.centerLng + lngOffset,
          alt: options.altitude,
          speed: 1.5 // Slower for precise work
        }));
      }
    }
    
    return waypoints;
  }

  generatePerimeterPattern(options: PerimeterPatternOptions): TaskWaypoint[] {
    const waypoints: TaskWaypoint[] = [];
    
    const metersPerDegreeLat = 111000.0;
    const metersPerDegreeLng = 111000.0 * Math.cos(options.centerLat * Math.PI / 180.0);
    
    const buffer = options.buffer || 2.0; // Default 2m buffer
    const adjustedWidth = options.width - (2 * buffer);
    const adjustedHeight = options.height - (2 * buffer);
    
    const latOffset = adjustedHeight / 2.0 / metersPerDegreeLat;
    const lngOffset = adjustedWidth / 2.0 / metersPerDegreeLng;
    
    // Create rectangular perimeter
    const corners = [
      { lat: options.centerLat - latOffset, lng: options.centerLng - lngOffset }, // Bottom-left
      { lat: options.centerLat - latOffset, lng: options.centerLng + lngOffset }, // Bottom-right
      { lat: options.centerLat + latOffset, lng: options.centerLng + lngOffset }, // Top-right
      { lat: options.centerLat + latOffset, lng: options.centerLng - lngOffset }, // Top-left
      { lat: options.centerLat - latOffset, lng: options.centerLng - lngOffset }  // Return to start
    ];
    
    corners.forEach(corner => {
      waypoints.push(createWaypoint({
        lat: corner.lat,
        lng: corner.lng,
        alt: options.altitude,
        speed: 2.0
      }));
    });
    
    return waypoints;
  }

  generateCustomPolygonPattern(options: CustomPolygonPatternOptions): TaskWaypoint[] {
    const waypoints: TaskWaypoint[] = [];
    
    if (options.vertices.length < 3) {
      throw new Error('Polygon must have at least 3 vertices');
    }
    
    switch (options.fillPattern) {
      case 'spiral':
        return this.generatePolygonSpiralFill(options);
      case 'zigzag':
        return this.generatePolygonZigzagFill(options);
      case 'parallel':
      default:
        return this.generatePolygonParallelFill(options);
    }
  }

  private generatePolygonParallelFill(options: CustomPolygonPatternOptions): TaskWaypoint[] {
    // Simplified parallel fill for polygon
    const waypoints: TaskWaypoint[] = [];
    
    // Create perimeter first
    options.vertices.forEach(vertex => {
      waypoints.push(createWaypoint({
        lat: vertex.lat,
        lng: vertex.lng,
        alt: options.altitude
      }));
    });
    
    // Close the polygon
    if (options.vertices.length > 0 && options.vertices[0]) {
      waypoints.push(createWaypoint({
        lat: options.vertices[0].lat,
        lng: options.vertices[0].lng,
        alt: options.altitude
      }));
    }
    
    return waypoints;
  }

  private generatePolygonSpiralFill(options: CustomPolygonPatternOptions): TaskWaypoint[] {
    // Simplified spiral fill for polygon
    return this.generatePolygonParallelFill(options);
  }

  private generatePolygonZigzagFill(options: CustomPolygonPatternOptions): TaskWaypoint[] {
    // Simplified zigzag fill for polygon
    return this.generatePolygonParallelFill(options);
  }

  // Utility methods
  createSimpleWaypointMission(waypoints: Array<{lat: number, lng: number, alt: number}>): TaskWaypoint[] {
    return waypoints.map(wp => createWaypoint({
      lat: wp.lat,
      lng: wp.lng,
      alt: wp.alt
    }));
  }

  createTakeoffLandMission(takeoffLat: number, takeoffLng: number, takeoffAlt: number, 
                          waypoints: TaskWaypoint[], landLat?: number, landLng?: number): TaskWaypoint[] {
    const mission: TaskWaypoint[] = [];
    
    // Add takeoff
    mission.push(createTakeoffWaypoint(takeoffLat, takeoffLng, takeoffAlt));
    
    // Add waypoints
    mission.push(...waypoints);
    
    // Add landing (use last waypoint location if not specified)
    const landLocation = {
      lat: landLat || waypoints[waypoints.length - 1]?.latitude || takeoffLat,
      lng: landLng || waypoints[waypoints.length - 1]?.longitude || takeoffLng
    };
    mission.push(createLandWaypoint(landLocation.lat, landLocation.lng));
    
    return mission;
  }

  // Event handling
  onTaskEvent(handler: (event: TaskEventPayload) => void): () => void {
    this.taskEventHandlers.push(handler);
    
    return () => {
      const index = this.taskEventHandlers.indexOf(handler);
      if (index > -1) {
        this.taskEventHandlers.splice(index, 1);
      }
    };
  }

  onTaskExecutionProgress(taskId: string, handler: (status: TaskExecutionStatus) => void): () => void {
    return this.onTaskEvent((event) => {
      if (event.type === 'task_execution_progress' && event.data.taskId === taskId) {
        handler(event.data);
      }
    });
  }

  onTaskStatusChange(taskId: string, handler: (status: TaskStatus) => void): () => void {
    return this.onTaskEvent((event) => {
      if ((event.type === 'task_execution_started' || 
           event.type === 'task_execution_paused' ||
           event.type === 'task_execution_resumed' ||
           event.type === 'task_execution_completed' ||
           event.type === 'task_execution_failed' ||
           event.type === 'task_execution_cancelled') && 
          event.data.taskId === taskId) {
        handler(event.data.status);
      }
    });
  }

  // Status checking
  isOperationInProgress(taskId: string): boolean {
    return this.operationInProgress.has(taskId);
  }

  hasActiveOperations(): boolean {
    return this.operationInProgress.size > 0;
  }

  // Helper methods for task validation
  validateTask(task: TaskCreateRequest): string[] {
    const errors: string[] = [];
    
    if (!task.name || task.name.trim().length === 0) {
      errors.push('Task name is required');
    }
    
    if (!task.type) {
      errors.push('Task type is required');
    }
    
    if (task.waypoints && task.waypoints.length === 0) {
      errors.push('At least one waypoint is required');
    }
    
    if (task.waypoints) {
      task.waypoints.forEach((wp, index) => {
        if (Math.abs(wp.latitude) > 90) {
          errors.push(`Waypoint ${index + 1}: Invalid latitude`);
        }
        if (Math.abs(wp.longitude) > 180) {
          errors.push(`Waypoint ${index + 1}: Invalid longitude`);
        }
      });
    }
    
    return errors;
  }

  // Distance and time calculations
  calculateWaypointDistance(wp1: TaskWaypoint, wp2: TaskWaypoint): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (wp2.latitude - wp1.latitude) * Math.PI / 180;
    const dLng = (wp2.longitude - wp1.longitude) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(wp1.latitude * Math.PI / 180) * Math.cos(wp2.latitude * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  calculateTotalDistance(waypoints: TaskWaypoint[]): number {
    if (waypoints.length < 2) return 0;
    
    let totalDistance = 0;
    for (let i = 1; i < waypoints.length; i++) {
      const prev = waypoints[i-1];
      const current = waypoints[i];
      if (prev && current) {
        totalDistance += this.calculateWaypointDistance(prev, current);
      }
    }
    return totalDistance;
  }

  calculateOptimizedDistance(waypoints: TaskWaypoint[], options?: PatternOptimizationOptions): number {
    if (waypoints.length < 2) return 0;
    
    let optimizedWaypoints = [...waypoints];
    
    // Apply optimizations
    if (options?.minimizeDistance) {
      optimizedWaypoints = this.optimizeWaypointOrder(optimizedWaypoints);
    }
    
    if (options?.avoidObstacles) {
      optimizedWaypoints = this.applyObstacleAvoidance(optimizedWaypoints, options.avoidObstacles);
    }
    
    return this.calculateTotalDistance(optimizedWaypoints);
  }

  estimateExecutionTime(waypoints: TaskWaypoint[], averageSpeed: number = 2.0): number {
    const distance = this.calculateTotalDistance(waypoints);
    return Math.ceil(distance / averageSpeed); // seconds
  }

  estimateAdvancedExecutionTime(waypoints: TaskWaypoint[], options: {
    averageSpeed?: number;
    windSpeed?: number;
    windDirection?: number;
    batteryCapacity?: number;
    terrainDifficulty?: number;
  } = {}): { time: number; batteryUsage: number; details: any } {
    const baseDistance = this.calculateTotalDistance(waypoints);
    const baseSpeed = options.averageSpeed || 2.0;
    
    // Wind factor calculation
    let windFactor = 1.0;
    if (options.windSpeed && options.windDirection !== undefined) {
      windFactor = this.calculateWindResistanceFactor(waypoints, options.windSpeed, options.windDirection);
    }
    
    // Terrain factor
    const terrainFactor = 1.0 + (options.terrainDifficulty || 0) * 0.3;
    
    // Altitude change factor
    const altitudeFactor = this.calculateAltitudeChangeFactor(waypoints);
    
    const adjustedSpeed = baseSpeed / (windFactor * terrainFactor * altitudeFactor);
    const estimatedTime = Math.ceil(baseDistance / adjustedSpeed);
    
    // Battery usage calculation (simplified)
    const baseBatteryUsage = (estimatedTime / 3600) * 20; // 20% per hour baseline
    const batteryUsage = baseBatteryUsage * windFactor * terrainFactor * altitudeFactor;
    
    return {
      time: estimatedTime,
      batteryUsage: Math.min(100, batteryUsage),
      details: {
        baseDistance,
        windFactor,
        terrainFactor,
        altitudeFactor,
        adjustedSpeed
      }
    };
  }

  calculateFlightPath3D(waypoints: TaskWaypoint[]): Array<{lat: number, lng: number, alt: number, distance: number, time: number}> {
    if (waypoints.length === 0) return [];
    
    const path = [];
    let cumulativeDistance = 0;
    let cumulativeTime = 0;
    
    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i];
      if (!wp) continue;
      
      if (i > 0) {
        const prevWp = waypoints[i-1];
        if (!prevWp) continue;
        
        const segmentDistance = this.calculateWaypointDistance(prevWp, wp);
        const altitudeChange = Math.abs(wp.altitude - prevWp.altitude);
        const segmentTime = this.calculateSegmentTime(segmentDistance, altitudeChange, wp.speed || 2.0);
        
        cumulativeDistance += segmentDistance;
        cumulativeTime += segmentTime;
      }
      
      path.push({
        lat: wp.latitude,
        lng: wp.longitude,
        alt: wp.altitude,
        distance: cumulativeDistance,
        time: cumulativeTime
      });
    }
    
    return path;
  }

  optimizeWaypointOrder(waypoints: TaskWaypoint[]): TaskWaypoint[] {
    if (waypoints.length <= 2) return waypoints;
    
    // Simple nearest neighbor optimization (TSP approximation)
    const optimized = [waypoints[0]]; // Start with first waypoint
    const remaining = waypoints.slice(1);
    
    while (remaining.length > 0) {
      const current = optimized[optimized.length - 1];
      if (!current || !remaining[0]) break;
      
      let nearestIndex = 0;
      let nearestDistance = this.calculateWaypointDistance(current, remaining[0]);
      
      for (let i = 1; i < remaining.length; i++) {
        const remainingWp = remaining[i];
        if (!remainingWp) continue;
        
        const distance = this.calculateWaypointDistance(current, remainingWp);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = i;
        }
      }
      
      const removed = remaining.splice(nearestIndex, 1)[0];
      if (removed) {
        optimized.push(removed);
      }
    }
    
    return optimized.filter((wp): wp is TaskWaypoint => wp !== undefined);
  }

  private applyObstacleAvoidance(waypoints: TaskWaypoint[], obstacles: Array<{lat: number, lng: number, radius: number}>): TaskWaypoint[] {
    // Simplified obstacle avoidance - increase altitude near obstacles
    return waypoints.map(wp => {
      let maxAltitudeIncrease = 0;
      
      obstacles.forEach(obstacle => {
        const distance = this.calculateWaypointDistance(wp, {
          latitude: obstacle.lat,
          longitude: obstacle.lng,
          altitude: wp.altitude
        } as TaskWaypoint);
        
        if (distance < obstacle.radius * 2) {
          const altitudeIncrease = Math.max(0, (obstacle.radius * 2 - distance) / obstacle.radius * 10);
          maxAltitudeIncrease = Math.max(maxAltitudeIncrease, altitudeIncrease);
        }
      });
      
      return {
        ...wp,
        altitude: wp.altitude + maxAltitudeIncrease
      };
    });
  }

  private calculateWindResistanceFactor(waypoints: TaskWaypoint[], windSpeed: number, windDirection: number): number {
    if (waypoints.length < 2) return 1.0;
    
    let totalWindEffect = 0;
    let segmentCount = 0;
    
    for (let i = 1; i < waypoints.length; i++) {
      const prev = waypoints[i-1];
      const current = waypoints[i];
      if (!prev || !current) continue;
      
      const bearing = this.calculateBearing(prev, current);
      const windAngle = Math.abs(bearing - windDirection);
      const normalizedAngle = Math.min(windAngle, 360 - windAngle);
      
      // Wind resistance peaks at headwind (0°) and is minimal at tailwind (180°)
      const windEffect = 1 + (windSpeed / 10) * (Math.cos(normalizedAngle * Math.PI / 180) * 0.3);
      totalWindEffect += windEffect;
      segmentCount++;
    }
    
    return segmentCount > 0 ? totalWindEffect / segmentCount : 1.0;
  }

  private calculateAltitudeChangeFactor(waypoints: TaskWaypoint[]): number {
    if (waypoints.length < 2) return 1.0;
    
    let totalAltitudeChange = 0;
    for (let i = 1; i < waypoints.length; i++) {
      const current = waypoints[i];
      const prev = waypoints[i-1];
      if (current && prev) {
        totalAltitudeChange += Math.abs(current.altitude - prev.altitude);
      }
    }
    
    // Factor increases with altitude changes (more energy required)
    return 1 + (totalAltitudeChange / 100) * 0.1; // 10% increase per 100m altitude change
  }

  private calculateSegmentTime(distance: number, altitudeChange: number, speed: number): number {
    const horizontalTime = distance / speed;
    const verticalTime = altitudeChange / 2.0; // Assume 2 m/s vertical speed
    return Math.max(horizontalTime, verticalTime);
  }

  private calculateBearing(from: TaskWaypoint, to: TaskWaypoint): number {
    const lat1 = from.latitude * Math.PI / 180;
    const lat2 = to.latitude * Math.PI / 180;
    const deltaLng = (to.longitude - from.longitude) * Math.PI / 180;
    
    const y = Math.sin(deltaLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
    
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }
}
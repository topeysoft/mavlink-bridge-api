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
      description,
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
      description,
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
      description,
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
    // For now, use the same logic as mowing pattern
    // In a real implementation, this might have different optimization
    return this.generateMowingPattern({
      centerLat: options.centerLat,
      centerLng: options.centerLng,
      width: options.width,
      height: options.height,
      spacing: options.spacing,
      altitude: options.altitude
    });
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
      totalDistance += this.calculateWaypointDistance(waypoints[i-1], waypoints[i]);
    }
    return totalDistance;
  }

  estimateExecutionTime(waypoints: TaskWaypoint[], averageSpeed: number = 2.0): number {
    const distance = this.calculateTotalDistance(waypoints);
    return Math.ceil(distance / averageSpeed); // seconds
  }
}
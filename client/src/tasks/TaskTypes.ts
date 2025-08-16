export enum TaskType {
  WAYPOINT_MISSION = 'waypoint_mission',
  MOWING = 'mowing',
  SPRAYING = 'spraying',
  LEAF_BLOWING = 'leaf_blowing',
  TOWING = 'towing',
  SNOW_REMOVAL = 'snow_removal',
  PATROLLING = 'patrolling',
  SURVEYING = 'surveying',
  CUSTOM = 'custom'
}

export enum TaskStatus {
  CREATED = 'created',
  READY = 'ready',
  EXECUTING = 'executing',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum TaskPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum TaskExecutionResult {
  SUCCESS = 'success',
  TASK_NOT_FOUND = 'task_not_found',
  INVALID_TASK = 'invalid_task',
  ALREADY_EXECUTING = 'already_executing',
  EXECUTION_FAILED = 'execution_failed',
  CANCELLED_BY_USER = 'cancelled_by_user',
  TIMEOUT = 'timeout',
  COMMUNICATION_ERROR = 'communication_error',
  VEHICLE_NOT_READY = 'vehicle_not_ready'
}

export enum TaskBackupFormat {
  JSON = 'json',
  COMPRESSED_JSON = 'compressed_json',
  BINARY = 'binary'
}

export interface TaskWaypoint {
  latitude: number;
  longitude: number;
  altitude: number;
  speed?: number;
  yaw?: number;
  acceptanceRadius?: number;
  command?: number;
  param1?: number;
  param2?: number;
  param3?: number;
  param4?: number;
  dwellTime?: number;
}

export interface TaskParameters {
  speed?: number;
  altitude?: number;
  acceptanceRadius?: number;
  loiterTime?: number;
  returnToLaunch?: boolean;
  maxExecutionTime?: number;
  customParameters?: string;
}

export interface TaskMetadata {
  id: string;
  name: string;
  description?: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  createdTime: number;
  modifiedTime: number;
  executionStartTime?: number;
  executionEndTime?: number;
  createdBy?: string;
  version: number;
  estimatedDuration?: number;
}

export interface Task {
  metadata: TaskMetadata;
  parameters: TaskParameters;
  waypoints: TaskWaypoint[];
  compressionRatio?: number;
  totalDistance?: number;
  estimatedTime?: number;
}

export interface TaskCreateRequest {
  name: string;
  description?: string;
  type: TaskType;
  priority?: TaskPriority;
  parameters?: TaskParameters;
  waypoints?: TaskWaypoint[];
}

export interface TaskUpdateRequest {
  name?: string;
  description?: string;
  priority?: TaskPriority;
  parameters?: TaskParameters;
  waypoints?: TaskWaypoint[];
}

export interface TaskListResponse {
  tasks: Task[];
  totalCount: number;
  filteredCount?: number;
}

export interface TaskExecutionRequest {
  validateBeforeExecution?: boolean;
  autoRetryOnFailure?: boolean;
  maxRetries?: number;
  timeoutSeconds?: number;
  targetSystem?: number;
  targetComponent?: number;
}

export interface TaskExecutionResponse {
  success: boolean;
  taskId: string;
  operation: string;
  executionId?: string;
  message?: string;
  errorCode?: string;
}

export interface TaskExecutionStatus {
  taskId: string;
  status: TaskStatus;
  startTime?: number;
  lastUpdateTime?: number;
  currentWaypointIndex?: number;
  totalWaypoints?: number;
  progress: number;
  distanceRemaining?: number;
  estimatedTimeRemaining?: number;
  lastError?: string;
}

export interface TaskImportRequest {
  data: string;
  format?: TaskBackupFormat;
  overwriteExisting?: boolean;
  validateBeforeImport?: boolean;
  createBackupBeforeImport?: boolean;
}

export interface TaskImportResponse {
  success: boolean;
  tasksImported: number;
  totalTasks: number;
  skippedTasks?: number;
  errors?: string[];
  processingTime?: number;
}

export interface TaskExportRequest {
  taskIds?: string[];
  format?: TaskBackupFormat;
  includeMetadata?: boolean;
  includeWaypoints?: boolean;
  compressData?: boolean;
  description?: string;
}

export interface TaskExportResponse {
  success: boolean;
  data: string;
  tasksExported: number;
  totalSize?: number;
  compressionRatio?: number;
  processingTime?: number;
  format?: string;
}

export interface TaskTemplate {
  id: string;
  name: string;
  description?: string;
  type: TaskType;
  parameters?: TaskParameters;
  waypointPattern?: any;
  previewImage?: string;
  estimatedDuration?: number;
}

export interface TaskTemplateListResponse {
  templates: TaskTemplate[];
  totalCount?: number;
}

export interface TaskFromTemplateRequest {
  templateId: string;
  name: string;
  description?: string;
  parameters?: TaskParameters;
  templateParameters?: Record<string, any>;
}

export interface TaskListOptions {
  type?: TaskType;
  status?: TaskStatus;
  priority?: TaskPriority;
}

export interface CreateWaypointOptions {
  lat: number;
  lng: number;
  alt: number;
  speed?: number;
  yaw?: number;
  acceptanceRadius?: number;
  command?: number;
  param1?: number;
  param2?: number;
  param3?: number;
  param4?: number;
  dwellTime?: number;
}

export interface MowingPatternOptions {
  centerLat: number;
  centerLng: number;
  width: number;
  height: number;
  spacing: number;
  altitude: number;
  speed?: number;
}

export interface SurveyPatternOptions {
  centerLat: number;
  centerLng: number;
  width: number;
  height: number;
  spacing: number;
  altitude: number;
  backAndForth?: boolean;
}

export interface TaskEventPayload {
  type: 'task_created' | 'task_updated' | 'task_deleted' | 
        'task_execution_started' | 'task_execution_progress' | 'task_execution_paused' |
        'task_execution_resumed' | 'task_execution_completed' | 'task_execution_failed' | 'task_execution_cancelled';
  data: any;
  timestamp: number;
}

export interface TaskStatistics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageExecutionTime: number;
  totalExecutionTime: number;
  tasksByType: Record<TaskType, number>;
  tasksByStatus: Record<TaskStatus, number>;
}

// Utility functions
export function getTaskTypeDisplayName(type: TaskType): string {
  switch (type) {
    case TaskType.WAYPOINT_MISSION: return 'Waypoint Mission';
    case TaskType.MOWING: return 'Mowing';
    case TaskType.SPRAYING: return 'Spraying';
    case TaskType.LEAF_BLOWING: return 'Leaf Blowing';
    case TaskType.TOWING: return 'Towing';
    case TaskType.SNOW_REMOVAL: return 'Snow Removal';
    case TaskType.PATROLLING: return 'Patrolling';
    case TaskType.SURVEYING: return 'Surveying';
    case TaskType.CUSTOM: return 'Custom';
    default: return 'Unknown';
  }
}

export function getTaskStatusDisplayName(status: TaskStatus): string {
  switch (status) {
    case TaskStatus.CREATED: return 'Created';
    case TaskStatus.READY: return 'Ready';
    case TaskStatus.EXECUTING: return 'Executing';
    case TaskStatus.PAUSED: return 'Paused';
    case TaskStatus.COMPLETED: return 'Completed';
    case TaskStatus.FAILED: return 'Failed';
    case TaskStatus.CANCELLED: return 'Cancelled';
    default: return 'Unknown';
  }
}

export function getTaskPriorityDisplayName(priority: TaskPriority): string {
  switch (priority) {
    case TaskPriority.LOW: return 'Low';
    case TaskPriority.NORMAL: return 'Normal';
    case TaskPriority.HIGH: return 'High';
    case TaskPriority.CRITICAL: return 'Critical';
    default: return 'Unknown';
  }
}

export function createDefaultTaskParameters(): TaskParameters {
  return {
    speed: 2.0,
    altitude: 10.0,
    acceptanceRadius: 2.0,
    loiterTime: 0,
    returnToLaunch: true,
    maxExecutionTime: 3600
  };
}

export function createWaypoint(options: CreateWaypointOptions): TaskWaypoint {
  return {
    latitude: options.lat,
    longitude: options.lng,
    altitude: options.alt,
    speed: options.speed || 0,
    yaw: options.yaw,
    acceptanceRadius: options.acceptanceRadius || 0,
    command: options.command || 16, // MAV_CMD_NAV_WAYPOINT
    param1: options.param1 || 0,
    param2: options.param2 || 0,
    param3: options.param3 || 0,
    param4: options.param4 || 0,
    dwellTime: options.dwellTime || 0
  };
}

export function createTakeoffWaypoint(lat: number, lng: number, alt: number): TaskWaypoint {
  return createWaypoint({
    lat,
    lng,
    alt,
    command: 22 // MAV_CMD_NAV_TAKEOFF
  });
}

export function createLandWaypoint(lat: number, lng: number): TaskWaypoint {
  return createWaypoint({
    lat,
    lng,
    alt: 0,
    command: 21 // MAV_CMD_NAV_LAND
  });
}

export function createLoiterWaypoint(lat: number, lng: number, alt: number, radius: number, time: number): TaskWaypoint {
  return createWaypoint({
    lat,
    lng,
    alt,
    command: 17, // MAV_CMD_NAV_LOITER_TIME
    param1: time,
    param3: radius
  });
}

export function createReturnToLaunchWaypoint(): TaskWaypoint {
  return createWaypoint({
    lat: 0,
    lng: 0,
    alt: 0,
    command: 20 // MAV_CMD_NAV_RETURN_TO_LAUNCH
  });
}
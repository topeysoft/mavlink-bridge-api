export interface MissionItem {
  seq: number;
  frame: number;
  command: number;
  current: number;
  autocontinue: number;
  param1: number;
  param2: number;
  param3: number;
  param4: number;
  x: number;
  y: number;
  z: number;
  missionType?: number;
}

export interface WaypointMissionItem extends MissionItem {
  lat: number;
  lng: number;
  alt: number;
}

export interface MissionPlan {
  items: MissionItem[];
  targetSystem?: number;
  targetComponent?: number;
}

export interface MissionUploadOptions {
  targetSystem?: number;
  targetComponent?: number;
  missionType?: number;
}

export interface MissionDownloadOptions {
  targetSystem?: number;
  targetComponent?: number;
  missionType?: number;
}

export interface MissionStatus {
  count: number;
  current: number;
  reached: number;
  state: MissionState;
}

export interface MissionProgress {
  totalItems: number;
  currentItem: number;
  itemsReached: number;
  distanceToWaypoint?: number;
  estimatedTimeToWaypoint?: number;
}

export interface MissionOperationResult {
  success: boolean;
  operation: string;
  itemsProcessed?: number;
  totalItems?: number;
  errorMessage?: string;
  targetSystem: number;
  targetComponent: number;
}

export interface MissionUploadProgress {
  currentItem: number;
  totalItems: number;
  completed: boolean;
  error?: string;
}

export interface MissionDownloadProgress {
  currentItem: number;
  totalItems: number;
  completed: boolean;
  items: MissionItem[];
  error?: string;
}

export enum MissionState {
  MISSION_STATE_UNKNOWN = 0,
  MISSION_STATE_NO_MISSION = 1,
  MISSION_STATE_NOT_STARTED = 2,
  MISSION_STATE_ACTIVE = 3,
  MISSION_STATE_PAUSED = 4,
  MISSION_STATE_COMPLETE = 5
}

export enum MissionResult {
  MAV_MISSION_ACCEPTED = 0,
  MAV_MISSION_ERROR = 1,
  MAV_MISSION_UNSUPPORTED_FRAME = 2,
  MAV_MISSION_UNSUPPORTED = 3,
  MAV_MISSION_NO_SPACE = 4,
  MAV_MISSION_INVALID = 5,
  MAV_MISSION_INVALID_PARAM1 = 6,
  MAV_MISSION_INVALID_PARAM2 = 7,
  MAV_MISSION_INVALID_PARAM3 = 8,
  MAV_MISSION_INVALID_PARAM4 = 9,
  MAV_MISSION_INVALID_PARAM5_X = 10,
  MAV_MISSION_INVALID_PARAM6_Y = 11,
  MAV_MISSION_INVALID_PARAM7 = 12,
  MAV_MISSION_INVALID_SEQUENCE = 13,
  MAV_MISSION_DENIED = 14,
  MAV_MISSION_OPERATION_CANCELLED = 15
}

export enum MAVFrame {
  MAV_FRAME_GLOBAL = 0,
  MAV_FRAME_LOCAL_NED = 1,
  MAV_FRAME_MISSION = 2,
  MAV_FRAME_GLOBAL_RELATIVE_ALT = 3,
  MAV_FRAME_LOCAL_ENU = 4,
  MAV_FRAME_GLOBAL_INT = 5,
  MAV_FRAME_GLOBAL_RELATIVE_ALT_INT = 6,
  MAV_FRAME_LOCAL_OFFSET_NED = 7,
  MAV_FRAME_BODY_NED = 8,
  MAV_FRAME_BODY_OFFSET_NED = 9,
  MAV_FRAME_GLOBAL_TERRAIN_ALT = 10,
  MAV_FRAME_GLOBAL_TERRAIN_ALT_INT = 11,
  MAV_FRAME_BODY_FRD = 12,
  MAV_FRAME_RESERVED_13 = 13,
  MAV_FRAME_RESERVED_14 = 14,
  MAV_FRAME_RESERVED_15 = 15,
  MAV_FRAME_RESERVED_16 = 16,
  MAV_FRAME_RESERVED_17 = 17,
  MAV_FRAME_RESERVED_18 = 18,
  MAV_FRAME_RESERVED_19 = 19,
  MAV_FRAME_LOCAL_FRD = 20,
  MAV_FRAME_LOCAL_FLU = 21
}

export enum MAVMissionType {
  MAV_MISSION_TYPE_MISSION = 0,
  MAV_MISSION_TYPE_FENCE = 1,
  MAV_MISSION_TYPE_RALLY = 2,
  MAV_MISSION_TYPE_ALL = 255
}

export interface MissionCommandResult {
  command: number;
  result: MissionResult;
  progress?: number;
  resultParam2?: number;
  targetSystem: number;
  targetComponent: number;
}

export interface CreateWaypointOptions {
  lat: number;
  lng: number;
  alt: number;
  seq?: number;
  frame?: MAVFrame;
  autocontinue?: boolean;
  acceptanceRadius?: number;
  passRadius?: number;
  yawAngle?: number;
  loiterTime?: number;
}

export interface MissionEventPayload {
  type: 'mission_current' | 'mission_item_reached' | 'mission_ack' | 'mission_count';
  data: any;
  timestamp: number;
}
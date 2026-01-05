// MAVLink Mission/Waypoint Types for YardRover

/**
 * MAVLink Command IDs (common commands for ground vehicles)
 * Reference: https://mavlink.io/en/messages/common.html
 */
export enum MAV_CMD {
  // Navigation commands
  NAV_WAYPOINT = 16, // Navigate to waypoint
  NAV_LOITER_UNLIM = 17, // Loiter at position indefinitely
  NAV_LOITER_TIME = 19, // Loiter for specified time
  NAV_RETURN_TO_LAUNCH = 20, // Return to launch location
  NAV_LAND = 21, // Land at location
  NAV_CONTINUE_AND_CHANGE_ALT = 30, // Continue and change altitude
  NAV_LOITER_TO_ALT = 31, // Loiter to altitude

  // Conditional commands
  CONDITION_DELAY = 112, // Delay mission state machine
  CONDITION_CHANGE_ALT = 113, // Ascend/descend to altitude
  CONDITION_DISTANCE = 114, // Delay until within distance

  // DO commands (immediate actions)
  DO_SET_MODE = 176, // Set system mode
  DO_JUMP = 177, // Jump to command
  DO_CHANGE_SPEED = 178, // Change speed
  DO_SET_HOME = 179, // Set home position
  DO_SET_RELAY = 181, // Set relay on/off
  DO_REPEAT_RELAY = 182, // Cycle relay on/off
  DO_SET_SERVO = 183, // Set servo position
  DO_REPEAT_SERVO = 184, // Cycle servo position
  DO_DIGICAM_CONTROL = 203, // Control camera
  DO_SET_ROI = 201, // Set region of interest
  DO_PAUSE_CONTINUE = 193, // Pause/continue mission

  // Ground vehicle specific
  NAV_GUIDED_ENABLE = 92, // Enable guided mode
  DO_GRIPPER = 211, // Control gripper
}

/**
 * MAVLink Frame types for coordinate reference
 */
export enum MAV_FRAME {
  GLOBAL = 0, // Global (WGS84) coordinate frame + MSL altitude
  LOCAL_NED = 1, // Local NED frame
  MISSION = 2, // Mission frame (used in mission items)
  GLOBAL_RELATIVE_ALT = 3, // Global (WGS84) + altitude relative to home
  LOCAL_ENU = 4, // Local East, North, Up frame
  GLOBAL_INT = 5, // Global (WGS84) frame, used as INT32
  GLOBAL_RELATIVE_ALT_INT = 6, // Global frame + relative altitude, INT32
  LOCAL_OFFSET_NED = 7, // Local NED with offset
  BODY_NED = 8, // Body fixed NED frame
  BODY_OFFSET_NED = 9, // Body fixed NED with offset
  GLOBAL_TERRAIN_ALT = 10, // Global (WGS84) + terrain altitude
  GLOBAL_TERRAIN_ALT_INT = 11, // Global + terrain altitude, INT32
}

/**
 * Waypoint interface representing a single mission item
 */
export interface Waypoint {
  id: string // Unique identifier for UI
  seq: number // Sequence number in mission (0-based)
  command: MAV_CMD // MAVLink command ID
  frame: MAV_FRAME // Coordinate frame
  current: boolean // Is this the current waypoint?
  autocontinue: boolean // Autocontinue to next waypoint

  // Position parameters
  latitude: number // Latitude (degrees) or X local
  longitude: number // Longitude (degrees) or Y local
  altitude: number // Altitude (meters) or Z local

  // Command-specific parameters (meaning varies by command)
  param1: number // Hold time (seconds) or other
  param2: number // Acceptance radius (meters) or other
  param3: number // Pass radius or other
  param4: number // Yaw angle (degrees) or other
}

/**
 * Mission plan containing multiple waypoints
 */
export interface MissionPlan {
  id: string
  name: string
  description?: string
  created: string
  lastModified: string
  waypoints: Waypoint[]
  homePosition?: {
    latitude: number
    longitude: number
    altitude: number
  }
  estimatedDistance?: number // Total distance in meters
  estimatedDuration?: number // Estimated duration in seconds
  fenceEnabled?: boolean
  rallyPointsEnabled?: boolean
}

/**
 * Waypoint template for common navigation patterns
 */
export interface WaypointTemplate {
  id: string
  name: string
  description: string
  icon: string
  command: MAV_CMD
  defaultParams: {
    param1?: number
    param2?: number
    param3?: number
    param4?: number
  }
}

/**
 * Common waypoint templates
 */
export const WAYPOINT_TEMPLATES: WaypointTemplate[] = [
  {
    id: 'nav_waypoint',
    name: 'Navigation Waypoint',
    description: 'Navigate to a specific location',
    icon: 'location',
    command: MAV_CMD.NAV_WAYPOINT,
    defaultParams: {
      param1: 0, // Hold time (0 = continue)
      param2: 2, // Acceptance radius (2m)
      param3: 0, // Pass radius (0 = straight)
      param4: 0, // Yaw angle (0 = heading to next waypoint)
    },
  },
  {
    id: 'loiter_time',
    name: 'Loiter (Timed)',
    description: 'Circle at location for specified time',
    icon: 'timer',
    command: MAV_CMD.NAV_LOITER_TIME,
    defaultParams: {
      param1: 30, // Loiter time (30 seconds)
      param2: 5, // Radius (5m)
      param3: 0, // Not used
      param4: 0, // Yaw (0 = toward center)
    },
  },
  {
    id: 'loiter_unlim',
    name: 'Loiter (Unlimited)',
    description: 'Circle at location indefinitely',
    icon: 'loop',
    command: MAV_CMD.NAV_LOITER_UNLIM,
    defaultParams: {
      param1: 0, // Not used
      param2: 5, // Radius (5m)
      param3: 0, // Not used
      param4: 0, // Yaw
    },
  },
  {
    id: 'return_to_launch',
    name: 'Return to Launch',
    description: 'Return to home position',
    icon: 'home',
    command: MAV_CMD.NAV_RETURN_TO_LAUNCH,
    defaultParams: {
      param1: 0,
      param2: 0,
      param3: 0,
      param4: 0,
    },
  },
  {
    id: 'change_speed',
    name: 'Change Speed',
    description: 'Modify vehicle speed',
    icon: 'speed',
    command: MAV_CMD.DO_CHANGE_SPEED,
    defaultParams: {
      param1: 1, // Speed type (1 = ground speed)
      param2: 2.0, // Speed value (2.0 m/s)
      param3: -1, // Throttle (-1 = no change)
      param4: 0, // Relative (0 = absolute)
    },
  },
  {
    id: 'condition_delay',
    name: 'Delay',
    description: 'Wait for specified time',
    icon: 'pause',
    command: MAV_CMD.CONDITION_DELAY,
    defaultParams: {
      param1: 10, // Delay time (10 seconds)
      param2: 0,
      param3: 0,
      param4: 0,
    },
  },
  {
    id: 'do_set_servo',
    name: 'Set Servo',
    description: 'Set servo to position',
    icon: 'settings',
    command: MAV_CMD.DO_SET_SERVO,
    defaultParams: {
      param1: 9, // Servo number
      param2: 1500, // PWM value (1500 = neutral)
      param3: 0,
      param4: 0,
    },
  },
  {
    id: 'do_set_relay',
    name: 'Set Relay',
    description: 'Turn relay on/off',
    icon: 'power',
    command: MAV_CMD.DO_SET_RELAY,
    defaultParams: {
      param1: 0, // Relay number
      param2: 1, // State (1 = on, 0 = off)
      param3: 0,
      param4: 0,
    },
  },
]

/**
 * Validation result for waypoint/mission
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Mission statistics
 */
export interface MissionStatistics {
  totalWaypoints: number
  totalDistance: number // meters
  estimatedTime: number // seconds
  navigationCommands: number
  doCommands: number
  conditionalCommands: number
  maxAltitude: number
  minAltitude: number
}

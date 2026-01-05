/**
 * Telemetry data types for IMU, compass, and sensor data
 */

/**
 * IMU (Inertial Measurement Unit) data
 */
export interface IMUData {
  timestamp: number;
  // Accelerometer (m/s^2)
  acceleration: {
    x: number;
    y: number;
    z: number;
  };
  // Gyroscope (rad/s)
  angularVelocity: {
    x: number;
    y: number;
    z: number;
  };
  // Magnetometer (gauss)
  magneticField: {
    x: number;
    y: number;
    z: number;
  };
  // Temperature (celsius)
  temperature?: number;
}

/**
 * Attitude data (orientation in 3D space)
 */
export interface AttitudeData {
  timestamp: number;
  // Euler angles (radians)
  roll: number;      // Bank angle
  pitch: number;     // Elevation angle
  yaw: number;       // Heading angle
  // Angular rates (rad/s)
  rollRate: number;
  pitchRate: number;
  yawRate: number;
}

/**
 * Compass/magnetometer data
 */
export interface CompassData {
  timestamp: number;
  // Magnetic heading (degrees, 0-360, 0=North)
  heading: number;
  // Magnetic field strength (milligauss)
  fieldStrength: {
    x: number;
    y: number;
    z: number;
  };
  // Declination (degrees)
  declination?: number;
  // Calibration status
  calibrationStatus?: 'uncalibrated' | 'calibrating' | 'calibrated' | 'error';
}

/**
 * VFR HUD (Visual Flight Rules Heads-Up Display) data
 */
export interface VfrHudData {
  timestamp: number;
  airspeed: number;      // m/s
  groundspeed: number;   // m/s
  heading: number;       // degrees
  throttle: number;      // percentage
  altitude: number;      // meters
  climbRate: number;     // m/s
}

/**
 * Derived IMU metrics
 */
export interface IMUMetrics {
  // Total acceleration magnitude (m/s^2)
  totalAcceleration: number;
  // Vibration level (0-1, normalized)
  vibrationLevel: number;
  // Tilt angle from vertical (degrees)
  tiltAngle: number;
  // Is the vehicle level? (tilt < threshold)
  isLevel: boolean;
  // IMU health status
  health: 'excellent' | 'good' | 'fair' | 'poor' | 'error';
}

/**
 * Compass health and calibration info
 */
export interface CompassHealth {
  isCalibrated: boolean;
  calibrationQuality: number; // 0-100
  interferenceLevel: 'low' | 'medium' | 'high';
  lastCalibrationDate?: Date;
  needsCalibration: boolean;
}

/**
 * Callback types for telemetry subscriptions
 */
export type IMUDataCallback = (data: IMUData) => void;
export type AttitudeDataCallback = (data: AttitudeData) => void;
export type CompassDataCallback = (data: CompassData) => void;
export type VfrHudDataCallback = (data: VfrHudData) => void;

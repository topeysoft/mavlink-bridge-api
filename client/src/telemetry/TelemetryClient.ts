import { WebSocketClient } from '../core/WebSocketClient';
import { EventType } from '../core/EventTypes';
import type {
  ScaledImuPayload,
  RawImuPayload,
  HighResImuPayload,
  AttitudePayload,
  VfrHudPayload
} from '../core/EventTypes';
import type {
  IMUData,
  AttitudeData,
  CompassData,
  VfrHudData,
  IMUDataCallback,
  AttitudeDataCallback,
  CompassDataCallback,
  VfrHudDataCallback
} from './TelemetryTypes';

/**
 * Client for subscribing to telemetry data (IMU, attitude, compass)
 */
export class TelemetryClient {
  private wsClient: WebSocketClient;
  private callbacks = new Map<string, Function[]>();

  constructor(wsClient: WebSocketClient) {
    this.wsClient = wsClient;
    this.setupEventListeners();
  }

  /**
   * Set up WebSocket event listeners for telemetry messages
   */
  private setupEventListeners(): void {
    // Scaled IMU - most common, provides accelerometer, gyro, and magnetometer in useful units
    this.wsClient.on(EventType.SCALED_IMU, (payload: any) => {
      const data = payload as ScaledImuPayload;
      const imuData: IMUData = {
        timestamp: Date.now(),
        acceleration: {
          x: data.xacc / 1000,  // Convert mg to m/s^2
          y: data.yacc / 1000,
          z: data.zacc / 1000
        },
        angularVelocity: {
          x: data.xgyro / 1000,  // Convert millirad/s to rad/s
          y: data.ygyro / 1000,
          z: data.zgyro / 1000
        },
        magneticField: {
          x: data.xmag / 1000,  // Convert milligauss to gauss
          y: data.ymag / 1000,
          z: data.zmag / 1000
        },
        ...(data.temperature !== undefined && { temperature: data.temperature / 100 })  // centidegrees to celsius
      };

      this.triggerCallbacks('imu', imuData);

      // Also extract compass data from magnetometer
      const compassData: CompassData = {
        timestamp: Date.now(),
        heading: this.calculateHeading(data.xmag, data.ymag),
        fieldStrength: {
          x: data.xmag / 1000,
          y: data.ymag / 1000,
          z: data.zmag / 1000
        }
      };

      this.triggerCallbacks('compass', compassData);
    });

    // Attitude - provides roll, pitch, yaw
    this.wsClient.on(EventType.ATTITUDE, (payload: any) => {
      const data = payload as AttitudePayload;
      const attitudeData: AttitudeData = {
        timestamp: Date.now(),
        roll: data.roll,
        pitch: data.pitch,
        yaw: data.yaw,
        rollRate: data.rollspeed,
        pitchRate: data.pitchspeed,
        yawRate: data.yawspeed
      };

      this.triggerCallbacks('attitude', attitudeData);
    });

    // VFR HUD - provides heading and other flight data
    this.wsClient.on(EventType.VFR_HUD, (payload: any) => {
      const data = payload as VfrHudPayload;
      const vfrData: VfrHudData = {
        timestamp: Date.now(),
        airspeed: data.airspeed,
        groundspeed: data.groundspeed,
        heading: data.heading,
        throttle: data.throttle,
        altitude: data.alt,
        climbRate: data.climb
      };

      this.triggerCallbacks('vfr', vfrData);

      // VFR HUD also provides heading for compass
      const compassData: CompassData = {
        timestamp: Date.now(),
        heading: data.heading,
        fieldStrength: { x: 0, y: 0, z: 0 } // Not available from VFR HUD
      };

      this.triggerCallbacks('compass', compassData);
    });

    // High-resolution IMU (optional, more detailed)
    this.wsClient.on(EventType.HIGHRES_IMU, (payload: any) => {
      const data = payload as HighResImuPayload;
      const imuData: IMUData = {
        timestamp: Date.now(),
        acceleration: {
          x: data.xacc,
          y: data.yacc,
          z: data.zacc
        },
        angularVelocity: {
          x: data.xgyro,
          y: data.ygyro,
          z: data.zgyro
        },
        magneticField: {
          x: data.xmag,
          y: data.ymag,
          z: data.zmag
        },
        temperature: data.temperature
      };

      this.triggerCallbacks('imu', imuData);
    });
  }

  /**
   * Calculate heading from magnetometer X and Y components
   * @param x Magnetic field X component (milligauss)
   * @param y Magnetic field Y component (milligauss)
   * @returns Heading in degrees (0-360, 0=North)
   */
  private calculateHeading(x: number, y: number): number {
    let heading = Math.atan2(y, x) * (180 / Math.PI);
    if (heading < 0) {
      heading += 360;
    }
    return heading;
  }

  /**
   * Trigger callbacks for a specific event type
   */
  private triggerCallbacks(eventType: string, data: unknown): void {
    const callbacks = this.callbacks.get(eventType) || [];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ${eventType} callback:`, error);
      }
    });
  }

  /**
   * Add a callback for a specific event type
   */
  private addCallback(eventType: string, callback: Function): void {
    if (!this.callbacks.has(eventType)) {
      this.callbacks.set(eventType, []);
    }
    this.callbacks.get(eventType)!.push(callback);
  }

  /**
   * Remove a callback for a specific event type
   */
  private removeCallback(eventType: string, callback: Function): void {
    const callbacks = this.callbacks.get(eventType);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Subscribe to IMU data updates
   * @param callback Function to call when IMU data is received
   * @returns Unsubscribe function
   */
  onIMUData(callback: IMUDataCallback): () => void {
    this.addCallback('imu', callback);
    return () => this.removeCallback('imu', callback);
  }

  /**
   * Subscribe to attitude (roll, pitch, yaw) updates
   * @param callback Function to call when attitude data is received
   * @returns Unsubscribe function
   */
  onAttitudeData(callback: AttitudeDataCallback): () => void {
    this.addCallback('attitude', callback);
    return () => this.removeCallback('attitude', callback);
  }

  /**
   * Subscribe to compass/heading updates
   * @param callback Function to call when compass data is received
   * @returns Unsubscribe function
   */
  onCompassData(callback: CompassDataCallback): () => void {
    this.addCallback('compass', callback);
    return () => this.removeCallback('compass', callback);
  }

  /**
   * Subscribe to VFR HUD data updates
   * @param callback Function to call when VFR data is received
   * @returns Unsubscribe function
   */
  onVfrHudData(callback: VfrHudDataCallback): () => void {
    this.addCallback('vfr', callback);
    return () => this.removeCallback('vfr', callback);
  }
}

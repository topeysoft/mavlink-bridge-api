/**
 * MAVLink message decoder for client-side processing
 * Decodes base64-encoded MAVLink payloads sent from ESP32
 */

import {
  MAVLinkMessageType,
  HeartbeatMessage,
  AttitudeMessage,
  GlobalPositionIntMessage,
  LocalPositionNedMessage,
  VfrHudMessage,
  BatteryStatusMessage,
  GpsRawIntMessage,
  GpsStatusMessage,
  ScaledImuMessage,
  RawImuMessage,
  HighResImuMessage,
  CommandAckMessage,
  SystemTimeMessage,
  ScaledPressureMessage,
  RcChannelsScaledMessage,
  ServoOutputRawMessage,
  MissionCurrentMessage,
  RcChannelsMessage,
  TimesyncMessage,
  PowerStatusMessage,
  VibrationMessage,
  ParamValueMessage
} from './MAVLinkTypes';

/**
 * Decoded MAVLink message with type and data
 */
export interface DecodedMAVLinkMessage<T = unknown> {
  messageId: number;
  systemId: number;
  componentId: number;
  messageName: string;
  data: T;
}

/**
 * MAVLink message decoder class
 */
export class MAVLinkDecoder {
  /**
   * Decode a base64-encoded MAVLink payload
   * @param messageId - MAVLink message ID
   * @param systemId - MAVLink system ID
   * @param componentId - MAVLink component ID
   * @param base64Payload - Base64-encoded payload data
   * @returns Decoded message or null if not supported
   */
  decode(
    messageId: number,
    systemId: number,
    componentId: number,
    base64Payload: string
  ): DecodedMAVLinkMessage | null {
    // Decode base64 to binary
    const binary = this.base64ToBytes(base64Payload);

    // Create DataView for reading binary data
    const view = new DataView(binary.buffer);

    // Decode based on message type
    let data: unknown = null;
    let messageName = 'UNKNOWN';

    try {
      switch (messageId) {
        case MAVLinkMessageType.HEARTBEAT:
          data = this.decodeHeartbeat(view);
          messageName = 'HEARTBEAT';
          break;

        case MAVLinkMessageType.SYS_STATUS:
          data = this.decodeSysStatus(view);
          messageName = 'SYS_STATUS';
          break;

        case MAVLinkMessageType.ATTITUDE:
          data = this.decodeAttitude(view);
          messageName = 'ATTITUDE';
          break;

        case MAVLinkMessageType.GLOBAL_POSITION_INT:
          data = this.decodeGlobalPositionInt(view);
          messageName = 'GLOBAL_POSITION_INT';
          break;

        case MAVLinkMessageType.LOCAL_POSITION_NED:
          data = this.decodeLocalPositionNed(view);
          messageName = 'LOCAL_POSITION_NED';
          break;

        case MAVLinkMessageType.GPS_RAW_INT:
          data = this.decodeGpsRawInt(view);
          messageName = 'GPS_RAW_INT';
          break;

        case MAVLinkMessageType.GPS_STATUS:
          data = this.decodeGpsStatus(view);
          messageName = 'GPS_STATUS';
          break;

        case MAVLinkMessageType.SCALED_IMU:
          data = this.decodeScaledImu(view);
          messageName = 'SCALED_IMU';
          break;

        case MAVLinkMessageType.RAW_IMU:
          data = this.decodeRawImu(view);
          messageName = 'RAW_IMU';
          break;

        case MAVLinkMessageType.HIGHRES_IMU:
          data = this.decodeHighResImu(view);
          messageName = 'HIGHRES_IMU';
          break;

        case MAVLinkMessageType.VFR_HUD:
          data = this.decodeVfrHud(view);
          messageName = 'VFR_HUD';
          break;

        case MAVLinkMessageType.BATTERY_STATUS:
          data = this.decodeBatteryStatus(view);
          messageName = 'BATTERY_STATUS';
          break;

        case MAVLinkMessageType.COMMAND_ACK:
          data = this.decodeCommandAck(view);
          messageName = 'COMMAND_ACK';
          break;

        case MAVLinkMessageType.SYSTEM_TIME:
          data = this.decodeSystemTime(view);
          messageName = 'SYSTEM_TIME';
          break;

        case MAVLinkMessageType.SCALED_PRESSURE:
          data = this.decodeScaledPressure(view);
          messageName = 'SCALED_PRESSURE';
          break;

        case MAVLinkMessageType.RC_CHANNELS_SCALED:
          data = this.decodeRcChannelsScaled(view);
          messageName = 'RC_CHANNELS_SCALED';
          break;

        case MAVLinkMessageType.SERVO_OUTPUT_RAW:
          data = this.decodeServoOutputRaw(view);
          messageName = 'SERVO_OUTPUT_RAW';
          break;

        case MAVLinkMessageType.MISSION_CURRENT:
          data = this.decodeMissionCurrent(view);
          messageName = 'MISSION_CURRENT';
          break;

        case MAVLinkMessageType.RC_CHANNELS:
          data = this.decodeRcChannels(view);
          messageName = 'RC_CHANNELS';
          break;

        case MAVLinkMessageType.TIMESYNC:
          data = this.decodeTimesync(view);
          messageName = 'TIMESYNC';
          break;

        case MAVLinkMessageType.POWER_STATUS:
          data = this.decodePowerStatus(view);
          messageName = 'POWER_STATUS';
          break;

        case MAVLinkMessageType.VIBRATION:
          data = this.decodeVibration(view);
          messageName = 'VIBRATION';
          break;

        case MAVLinkMessageType.PARAM_VALUE:
          data = this.decodeParamValue(view);
          messageName = 'PARAM_VALUE';
          break;

        default:
          // Unsupported message type - return raw data
          return null;
      }

      return {
        messageId,
        systemId,
        componentId,
        messageName,
        data
      };

    } catch (error) {
      console.error(`Failed to decode MAVLink message ${messageId}:`, error);
      return null;
    }
  }

  /**
   * Convert base64 string to Uint8Array
   */
  private base64ToBytes(base64: string): Uint8Array {
    if (typeof window !== 'undefined' && window.atob) {
      // Browser environment
      const binaryString = window.atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    } else {
      // Node.js environment
      return new Uint8Array(Buffer.from(base64, 'base64'));
    }
  }

  /**
   * Decode HEARTBEAT message (ID: 0)
   * Fields: type, autopilot, base_mode, custom_mode, system_status, mavlink_version
   * Expected payload length: 9 bytes
   */
  private decodeHeartbeat(view: DataView): HeartbeatMessage {
    if (view.byteLength < 9) {
      throw new Error(`HEARTBEAT payload too short: expected 9 bytes, got ${view.byteLength}`);
    }

    return {
      type: view.getUint8(4),
      autopilot: view.getUint8(5),
      baseMode: view.getUint8(6),
      customMode: view.getUint32(0, true),  // little-endian
      systemStatus: view.getUint8(7),
      mavlinkVersion: view.getUint8(8)
    };
  }

  /**
   * Decode SYS_STATUS message (ID: 1)
   */
  private decodeSysStatus(view: DataView): {
    onboardControlSensorsPresent: number;
    onboardControlSensorsEnabled: number;
    onboardControlSensorsHealth: number;
    load: number;
    voltageBattery: number;
    currentBattery: number;
    batteryRemaining: number;
    dropRateComm: number;
    errorsComm: number;
    errorsCount1: number;
    errorsCount2: number;
    errorsCount3: number;
    errorsCount4: number;
  } {
    return {
      onboardControlSensorsPresent: view.getUint32(0, true),
      onboardControlSensorsEnabled: view.getUint32(4, true),
      onboardControlSensorsHealth: view.getUint32(8, true),
      load: view.getUint16(12, true) / 10,  // Convert to percentage
      voltageBattery: view.getUint16(14, true),  // mV
      currentBattery: view.getInt16(16, true),   // 10*mA
      batteryRemaining: view.getInt8(18),        // percentage
      dropRateComm: view.getUint16(19, true),    // 0.01%
      errorsComm: view.getUint16(21, true),
      errorsCount1: view.getUint16(23, true),
      errorsCount2: view.getUint16(25, true),
      errorsCount3: view.getUint16(27, true),
      errorsCount4: view.getUint16(29, true)
    };
  }

  /**
   * Decode ATTITUDE message (ID: 30)
   * Fields: time_boot_ms, roll, pitch, yaw, rollspeed, pitchspeed, yawspeed
   * Expected payload length: 28 bytes
   */
  private decodeAttitude(view: DataView): AttitudeMessage {
    if (view.byteLength < 28) {
      throw new Error(`ATTITUDE payload too short: expected 28 bytes, got ${view.byteLength}`);
    }

    return {
      timeBootMs: view.getUint32(0, true),
      roll: view.getFloat32(4, true),
      pitch: view.getFloat32(8, true),
      yaw: view.getFloat32(12, true),
      rollspeed: view.getFloat32(16, true),
      pitchspeed: view.getFloat32(20, true),
      yawspeed: view.getFloat32(24, true)
    };
  }

  /**
   * Decode GLOBAL_POSITION_INT message (ID: 33)
   */
  private decodeGlobalPositionInt(view: DataView): GlobalPositionIntMessage {
    return {
      timeBootMs: view.getUint32(0, true),
      lat: view.getInt32(4, true),
      lon: view.getInt32(8, true),
      alt: view.getInt32(12, true),
      relativeAlt: view.getInt32(16, true),
      vx: view.getInt16(20, true),
      vy: view.getInt16(22, true),
      vz: view.getInt16(24, true),
      hdg: view.getUint16(26, true)
    };
  }

  /**
   * Decode LOCAL_POSITION_NED message (ID: 32)
   */
  private decodeLocalPositionNed(view: DataView): LocalPositionNedMessage {
    return {
      timeBootMs: view.getUint32(0, true),
      x: view.getFloat32(4, true),
      y: view.getFloat32(8, true),
      z: view.getFloat32(12, true),
      vx: view.getFloat32(16, true),
      vy: view.getFloat32(20, true),
      vz: view.getFloat32(24, true)
    };
  }

  /**
   * Decode GPS_RAW_INT message (ID: 24)
   * Expected payload length: 20-50 bytes (supports message truncation)
   *
   * Message structure (fields ordered by size):
   * - time_usec (uint64, 8 bytes, offset 0) - required
   * - lat (int32, 4 bytes, offset 8) - required
   * - lon (int32, 4 bytes, offset 12) - required
   * - alt (int32, 4 bytes, offset 16) - required
   * - eph (uint16, 2 bytes, offset 20) - optional
   * - epv (uint16, 2 bytes, offset 22) - optional
   * - vel (uint16, 2 bytes, offset 24) - optional
   * - cog (uint16, 2 bytes, offset 26) - optional
   * - fix_type (uint8, 1 byte, offset 28) - optional
   * - satellites_visible (uint8, 1 byte, offset 29) - optional
   * Extensions (MAVLink 2 only):
   * - alt_ellipsoid (int32, 4 bytes, offset 30) - optional
   * - h_acc (uint32, 4 bytes, offset 34) - optional
   * - v_acc (uint32, 4 bytes, offset 38) - optional
   * - vel_acc (uint32, 4 bytes, offset 42) - optional
   * - hdg_acc (uint32, 4 bytes, offset 46) - optional
   */
  private decodeGpsRawInt(view: DataView): GpsRawIntMessage {
    // GPS_RAW_INT requires at least 20 bytes for core fields (time_usec, lat, lon, alt)
    if (view.byteLength < 20) {
      throw new Error(`GPS_RAW_INT payload too short: expected at least 20 bytes, got ${view.byteLength}`);
    }

    const result: GpsRawIntMessage = {
      timeUsec: Number(view.getBigUint64(0, true)),
      lat: view.getInt32(8, true),
      lon: view.getInt32(12, true),
      alt: view.getInt32(16, true),
      eph: 9999, // Default HDOP (unknown)
      epv: 9999, // Default VDOP (unknown)
      vel: 0,    // Default velocity
      cog: 0,    // Default course
      fixType: 0, // Default no fix
      satellitesVisible: 0 // Default no satellites
    };

    // Optional fields (may be truncated)
    if (view.byteLength >= 22) {
      result.eph = view.getUint16(20, true);
    }
    if (view.byteLength >= 24) {
      result.epv = view.getUint16(22, true);
    }
    if (view.byteLength >= 26) {
      result.vel = view.getUint16(24, true);
    }
    if (view.byteLength >= 28) {
      result.cog = view.getUint16(26, true);
    }
    if (view.byteLength >= 29) {
      result.fixType = view.getUint8(28);
    }
    if (view.byteLength >= 30) {
      result.satellitesVisible = view.getUint8(29);
    }

    // MAVLink 2 extensions (optional)
    if (view.byteLength >= 34) {
      result.altEllipsoid = view.getInt32(30, true);
    }
    if (view.byteLength >= 38) {
      result.hAcc = view.getUint32(34, true);
    }
    if (view.byteLength >= 42) {
      result.vAcc = view.getUint32(38, true);
    }
    if (view.byteLength >= 46) {
      result.velAcc = view.getUint32(42, true);
    }
    if (view.byteLength >= 50) {
      result.hdgAcc = view.getUint32(46, true);
    }

    return result;
  }

  /**
   * Decode GPS_STATUS message (ID: 25)
   */
  private decodeGpsStatus(view: DataView): GpsStatusMessage {
    const satellitesVisible = view.getUint8(0);
    const satellitePrn: number[] = [];
    const satelliteUsed: number[] = [];
    const satelliteElevation: number[] = [];
    const satelliteAzimuth: number[] = [];
    const satelliteSnr: number[] = [];

    for (let i = 0; i < satellitesVisible && i < 20; i++) {
      satellitePrn.push(view.getUint8(1 + i));
      satelliteUsed.push(view.getUint8(21 + i));
      satelliteElevation.push(view.getUint8(41 + i));
      satelliteAzimuth.push(view.getUint8(61 + i));
      satelliteSnr.push(view.getUint8(81 + i));
    }

    return {
      satellitesVisible,
      satellitePrn,
      satelliteUsed,
      satelliteElevation,
      satelliteAzimuth,
      satelliteSnr
    };
  }

  /**
   * Decode SCALED_IMU message (ID: 26)
   */
  private decodeScaledImu(view: DataView): ScaledImuMessage {
    const result: ScaledImuMessage = {
      timeBootMs: view.getUint32(0, true),
      xacc: view.getInt16(4, true),
      yacc: view.getInt16(6, true),
      zacc: view.getInt16(8, true),
      xgyro: view.getInt16(10, true),
      ygyro: view.getInt16(12, true),
      zgyro: view.getInt16(14, true),
      xmag: view.getInt16(16, true),
      ymag: view.getInt16(18, true),
      zmag: view.getInt16(20, true)
    };
    if (view.byteLength > 22) {
      result.temperature = view.getInt16(22, true);
    }
    return result;
  }

  /**
   * Decode RAW_IMU message (ID: 27)
   */
  private decodeRawImu(view: DataView): RawImuMessage {
    const result: RawImuMessage = {
      timeUsec: Number(view.getBigUint64(0, true)),
      xacc: view.getInt16(8, true),
      yacc: view.getInt16(10, true),
      zacc: view.getInt16(12, true),
      xgyro: view.getInt16(14, true),
      ygyro: view.getInt16(16, true),
      zgyro: view.getInt16(18, true),
      xmag: view.getInt16(20, true),
      ymag: view.getInt16(22, true),
      zmag: view.getInt16(24, true)
    };
    if (view.byteLength > 26) {
      result.id = view.getUint8(26);
    }
    if (view.byteLength > 27) {
      result.temperature = view.getInt16(27, true);
    }
    return result;
  }

  /**
   * Decode HIGHRES_IMU message (ID: 105)
   */
  private decodeHighResImu(view: DataView): HighResImuMessage {
    const result: HighResImuMessage = {
      timeUsec: Number(view.getBigUint64(0, true)),
      xacc: view.getFloat32(8, true),
      yacc: view.getFloat32(12, true),
      zacc: view.getFloat32(16, true),
      xgyro: view.getFloat32(20, true),
      ygyro: view.getFloat32(24, true),
      zgyro: view.getFloat32(28, true),
      xmag: view.getFloat32(32, true),
      ymag: view.getFloat32(36, true),
      zmag: view.getFloat32(40, true),
      absPressure: view.getFloat32(44, true),
      diffPressure: view.getFloat32(48, true),
      pressureAlt: view.getFloat32(52, true),
      temperature: view.getFloat32(56, true),
      fieldsUpdated: view.getUint16(60, true)
    };
    if (view.byteLength > 62) {
      result.id = view.getUint8(62);
    }
    return result;
  }

  /**
   * Decode VFR_HUD message (ID: 74)
   * Expected payload length: 16-20 bytes (MAVLink message truncation)
   *
   * Message structure (fields ordered by size for alignment):
   * - airspeed (float, 4 bytes, offset 0)
   * - groundspeed (float, 4 bytes, offset 4)
   * - alt (float, 4 bytes, offset 8)
   * - climb (float, 4 bytes, offset 12)
   * - heading (int16, 2 bytes, offset 16)
   * - throttle (uint16, 2 bytes, offset 18)
   */
  private decodeVfrHud(view: DataView): VfrHudMessage {
    // VFR_HUD requires at least 16 bytes for core fields (airspeed, groundspeed, alt, climb)
    if (view.byteLength < 16) {
      throw new Error(`VFR_HUD payload too short: expected at least 16 bytes, got ${view.byteLength}`);
    }

    const result: VfrHudMessage = {
      airspeed: view.getFloat32(0, true),
      groundspeed: view.getFloat32(4, true),
      alt: view.getFloat32(8, true),
      climb: view.getFloat32(12, true),
      heading: 0, // Default value
      throttle: 0  // Default value
    };

    // Heading and throttle are optional (message truncation)
    if (view.byteLength >= 18) {
      result.heading = view.getInt16(16, true);
    }
    if (view.byteLength >= 20) {
      result.throttle = view.getUint16(18, true);
    }

    return result;
  }

  /**
   * Decode BATTERY_STATUS message (ID: 147)
   * Expected payload length: 40 bytes minimum
   */
  private decodeBatteryStatus(view: DataView): BatteryStatusMessage {
    if (view.byteLength < 40) {
      throw new Error(`BATTERY_STATUS payload too short: expected 40 bytes, got ${view.byteLength}`);
    }

    const voltages: number[] = [];
    for (let i = 0; i < 10; i++) {
      voltages.push(view.getUint16(4 + i * 2, true));
    }

    return {
      id: view.getUint8(0),
      batteryFunction: view.getUint8(1),
      type: view.getUint8(2),
      temperature: view.getInt16(3, true),
      voltages,
      currentBattery: view.getInt16(24, true),
      currentConsumed: view.getInt32(26, true),
      energyConsumed: view.getInt32(30, true),
      batteryRemaining: view.getInt8(34),
      timeRemaining: view.getInt32(35, true),
      chargeState: view.getUint8(39)
    };
  }

  /**
   * Decode COMMAND_ACK message (ID: 77)
   */
  private decodeCommandAck(view: DataView): CommandAckMessage {
    return {
      command: view.getUint16(0, true),
      result: view.getUint8(2),
      progress: view.byteLength > 3 ? view.getUint8(3) : 0,
      resultParam2: view.byteLength > 4 ? view.getInt32(4, true) : 0,
      targetSystem: view.byteLength > 8 ? view.getUint8(8) : 0,
      targetComponent: view.byteLength > 9 ? view.getUint8(9) : 0
    };
  }

  /**
   * Decode SYSTEM_TIME message (ID: 2)
   * Expected payload length: 12 bytes (supports MAVLink 2 truncation - min 8 bytes)
   *
   * Message structure:
   * - time_unix_usec (uint64, 8 bytes, offset 0) - required
   * - time_boot_ms (uint32, 4 bytes, offset 8) - optional (may be truncated if zero)
   */
  private decodeSystemTime(view: DataView): SystemTimeMessage {
    if (view.byteLength < 8) {
      throw new Error(`SYSTEM_TIME payload too short: expected at least 8 bytes, got ${view.byteLength}`);
    }

    const result: SystemTimeMessage = {
      timeUnixUsec: Number(view.getBigUint64(0, true)),
      timeBootMs: 0 // Default value
    };

    // time_boot_ms is optional (may be truncated)
    if (view.byteLength >= 12) {
      result.timeBootMs = view.getUint32(8, true);
    }

    return result;
  }

  /**
   * Decode SCALED_PRESSURE message (ID: 29)
   * Expected payload length: 14 bytes
   */
  private decodeScaledPressure(view: DataView): ScaledPressureMessage {
    if (view.byteLength < 14) {
      throw new Error(`SCALED_PRESSURE payload too short: expected 14 bytes, got ${view.byteLength}`);
    }

    return {
      timeBootMs: view.getUint32(0, true),
      pressAbs: view.getFloat32(4, true),
      pressDiff: view.getFloat32(8, true),
      temperature: view.getInt16(12, true)
    };
  }

  /**
   * Decode RC_CHANNELS_SCALED message (ID: 34)
   * Expected payload length: 22 bytes
   */
  private decodeRcChannelsScaled(view: DataView): RcChannelsScaledMessage {
    if (view.byteLength < 22) {
      throw new Error(`RC_CHANNELS_SCALED payload too short: expected 22 bytes, got ${view.byteLength}`);
    }

    return {
      timeBootMs: view.getUint32(0, true),
      chan1Scaled: view.getInt16(4, true),
      chan2Scaled: view.getInt16(6, true),
      chan3Scaled: view.getInt16(8, true),
      chan4Scaled: view.getInt16(10, true),
      chan5Scaled: view.getInt16(12, true),
      chan6Scaled: view.getInt16(14, true),
      chan7Scaled: view.getInt16(16, true),
      chan8Scaled: view.getInt16(18, true),
      port: view.getUint8(20),
      rssi: view.getUint8(21)
    };
  }

  /**
   * Decode SERVO_OUTPUT_RAW message (ID: 36)
   * Expected payload length: 21+ bytes (supports MAVLink 2 truncation - min 4 bytes)
   *
   * Message structure (fields ordered by size for alignment):
   * - time_usec (uint32, 4 bytes, offset 0) - required
   * - servo1_raw (uint16, 2 bytes, offset 4) - optional (may be truncated if zero)
   * - servo2_raw (uint16, 2 bytes, offset 6) - optional
   * - servo3_raw (uint16, 2 bytes, offset 8) - optional
   * - servo4_raw (uint16, 2 bytes, offset 10) - optional
   * - servo5_raw (uint16, 2 bytes, offset 12) - optional
   * - servo6_raw (uint16, 2 bytes, offset 14) - optional
   * - servo7_raw (uint16, 2 bytes, offset 16) - optional
   * - servo8_raw (uint16, 2 bytes, offset 18) - optional
   * - port (uint8, 1 byte, offset 20) - optional
   * - servo9_raw through servo16_raw (MAVLink 2 extensions) - optional
   */
  private decodeServoOutputRaw(view: DataView): ServoOutputRawMessage {
    if (view.byteLength < 4) {
      throw new Error(`SERVO_OUTPUT_RAW payload too short: expected at least 4 bytes, got ${view.byteLength}`);
    }

    const result: ServoOutputRawMessage = {
      timeUsec: view.getUint32(0, true),
      servo1Raw: 0,
      servo2Raw: 0,
      servo3Raw: 0,
      servo4Raw: 0,
      servo5Raw: 0,
      servo6Raw: 0,
      servo7Raw: 0,
      servo8Raw: 0,
      port: 0
    };

    // All servo fields are optional (may be truncated)
    if (view.byteLength >= 6) result.servo1Raw = view.getUint16(4, true);
    if (view.byteLength >= 8) result.servo2Raw = view.getUint16(6, true);
    if (view.byteLength >= 10) result.servo3Raw = view.getUint16(8, true);
    if (view.byteLength >= 12) result.servo4Raw = view.getUint16(10, true);
    if (view.byteLength >= 14) result.servo5Raw = view.getUint16(12, true);
    if (view.byteLength >= 16) result.servo6Raw = view.getUint16(14, true);
    if (view.byteLength >= 18) result.servo7Raw = view.getUint16(16, true);
    if (view.byteLength >= 20) result.servo8Raw = view.getUint16(18, true);
    if (view.byteLength >= 21) result.port = view.getUint8(20);

    // Extended servo outputs (MAVLink 2)
    if (view.byteLength >= 23) result.servo9Raw = view.getUint16(21, true);
    if (view.byteLength >= 25) result.servo10Raw = view.getUint16(23, true);
    if (view.byteLength >= 27) result.servo11Raw = view.getUint16(25, true);
    if (view.byteLength >= 29) result.servo12Raw = view.getUint16(27, true);
    if (view.byteLength >= 31) result.servo13Raw = view.getUint16(29, true);
    if (view.byteLength >= 33) result.servo14Raw = view.getUint16(31, true);
    if (view.byteLength >= 35) result.servo15Raw = view.getUint16(33, true);
    if (view.byteLength >= 37) result.servo16Raw = view.getUint16(35, true);

    return result;
  }

  /**
   * Decode MISSION_CURRENT message (ID: 42)
   * Expected payload length: 2 bytes
   */
  private decodeMissionCurrent(view: DataView): MissionCurrentMessage {
    if (view.byteLength < 2) {
      throw new Error(`MISSION_CURRENT payload too short: expected 2 bytes, got ${view.byteLength}`);
    }

    return {
      seq: view.getUint16(0, true)
    };
  }

  /**
   * Decode RC_CHANNELS message (ID: 65)
   * Expected payload length: 42 bytes
   */
  private decodeRcChannels(view: DataView): RcChannelsMessage {
    if (view.byteLength < 42) {
      throw new Error(`RC_CHANNELS payload too short: expected 42 bytes, got ${view.byteLength}`);
    }

    return {
      timeBootMs: view.getUint32(0, true),
      chan1Raw: view.getUint16(4, true),
      chan2Raw: view.getUint16(6, true),
      chan3Raw: view.getUint16(8, true),
      chan4Raw: view.getUint16(10, true),
      chan5Raw: view.getUint16(12, true),
      chan6Raw: view.getUint16(14, true),
      chan7Raw: view.getUint16(16, true),
      chan8Raw: view.getUint16(18, true),
      chan9Raw: view.getUint16(20, true),
      chan10Raw: view.getUint16(22, true),
      chan11Raw: view.getUint16(24, true),
      chan12Raw: view.getUint16(26, true),
      chan13Raw: view.getUint16(28, true),
      chan14Raw: view.getUint16(30, true),
      chan15Raw: view.getUint16(32, true),
      chan16Raw: view.getUint16(34, true),
      chan17Raw: view.getUint16(36, true),
      chan18Raw: view.getUint16(38, true),
      chancount: view.getUint8(40),
      rssi: view.getUint8(41)
    };
  }

  /**
   * Decode TIMESYNC message (ID: 111)
   * Expected payload length: 16 bytes
   */
  private decodeTimesync(view: DataView): TimesyncMessage {
    if (view.byteLength < 16) {
      throw new Error(`TIMESYNC payload too short: expected 16 bytes, got ${view.byteLength}`);
    }

    return {
      tc1: Number(view.getBigInt64(0, true)),
      ts1: Number(view.getBigInt64(8, true))
    };
  }

  /**
   * Decode POWER_STATUS message (ID: 125)
   * Expected payload length: 6 bytes (supports MAVLink 2 truncation - min 2 bytes)
   *
   * Message structure:
   * - Vcc (uint16, 2 bytes, offset 0) - required
   * - Vservo (uint16, 2 bytes, offset 2) - optional (may be truncated if zero)
   * - flags (uint16, 2 bytes, offset 4) - optional (may be truncated if zero)
   */
  private decodePowerStatus(view: DataView): PowerStatusMessage {
    if (view.byteLength < 2) {
      throw new Error(`POWER_STATUS payload too short: expected at least 2 bytes, got ${view.byteLength}`);
    }

    const result: PowerStatusMessage = {
      vcc: view.getUint16(0, true),
      vservo: 0, // Default value
      flags: 0   // Default value
    };

    // Vservo and flags are optional (may be truncated)
    if (view.byteLength >= 4) {
      result.vservo = view.getUint16(2, true);
    }
    if (view.byteLength >= 6) {
      result.flags = view.getUint16(4, true);
    }

    return result;
  }

  /**
   * Decode VIBRATION message (ID: 241)
   * Expected payload length: 32 bytes (supports MAVLink 2 truncation - min 20 bytes)
   *
   * Message structure:
   * - time_usec (uint64, 8 bytes, offset 0) - required
   * - vibration_x (float, 4 bytes, offset 8) - required
   * - vibration_y (float, 4 bytes, offset 12) - required
   * - vibration_z (float, 4 bytes, offset 16) - required
   * - clipping_0 (uint32, 4 bytes, offset 20) - optional (may be truncated if zero)
   * - clipping_1 (uint32, 4 bytes, offset 24) - optional (may be truncated if zero)
   * - clipping_2 (uint32, 4 bytes, offset 28) - optional (may be truncated if zero)
   */
  private decodeVibration(view: DataView): VibrationMessage {
    if (view.byteLength < 20) {
      throw new Error(`VIBRATION payload too short: expected at least 20 bytes, got ${view.byteLength}`);
    }

    const result: VibrationMessage = {
      timeUsec: Number(view.getBigUint64(0, true)),
      vibrationX: view.getFloat32(8, true),
      vibrationY: view.getFloat32(12, true),
      vibrationZ: view.getFloat32(16, true),
      clipping0: 0, // Default value
      clipping1: 0, // Default value
      clipping2: 0  // Default value
    };

    // Clipping fields are optional (may be truncated)
    if (view.byteLength >= 24) {
      result.clipping0 = view.getUint32(20, true);
    }
    if (view.byteLength >= 28) {
      result.clipping1 = view.getUint32(24, true);
    }
    if (view.byteLength >= 32) {
      result.clipping2 = view.getUint32(28, true);
    }

    return result;
  }

  /**
   * Decode PARAM_VALUE message (ID: 22)
   * Expected payload length: 25 bytes
   *
   * Message structure:
   * - param_value (float, 4 bytes, offset 0)
   * - param_count (uint16, 2 bytes, offset 4)
   * - param_index (uint16, 2 bytes, offset 6)
   * - param_id (char[16], 16 bytes, offset 8)
   * - param_type (uint8, 1 byte, offset 24)
   */
  private decodeParamValue(view: DataView): ParamValueMessage {
    if (view.byteLength < 25) {
      throw new Error(`PARAM_VALUE payload too short: expected 25 bytes, got ${view.byteLength}`);
    }

    // Read param_id as null-terminated string (16 bytes)
    let paramId = '';
    for (let i = 0; i < 16; i++) {
      const charCode = view.getUint8(8 + i);
      if (charCode === 0) break; // Null terminator
      paramId += String.fromCharCode(charCode);
    }

    return {
      paramValue: view.getFloat32(0, true),
      paramCount: view.getUint16(4, true),
      paramIndex: view.getUint16(6, true),
      paramId: paramId.trim(),
      paramType: view.getUint8(24)
    };
  }
}

/**
 * Create a singleton decoder instance
 */
export const mavlinkDecoder = new MAVLinkDecoder();

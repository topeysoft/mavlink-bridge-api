import { HttpClient } from '../core/HttpClient';
import { MAVLinkCommandOptions, MAVLinkCommandResponse, ArduPilotMode, MAVCommand } from './MAVLinkTypes';

export interface CommandLongOptions extends MAVLinkCommandOptions {
  command: number;
  param1?: number;
  param2?: number;
  param3?: number;
  param4?: number;
  param5?: number;
  param6?: number;
  param7?: number;
}

export interface CommandIntOptions extends MAVLinkCommandOptions {
  command: number;
  frame?: number;
  current?: number;
  autocontinue?: number;
  param1?: number;
  param2?: number;
  param3?: number;
  param4?: number;
  x: number;
  y: number;
  z: number;
}

export interface SetModeOptions extends MAVLinkCommandOptions {
  customMode: number;
  baseMode?: number;
}

export interface PositionTargetOptions extends MAVLinkCommandOptions {
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  afx?: number;
  afy?: number;
  afz?: number;
  yaw?: number;
  yawRate?: number;
  timeBootMs?: number;
  coordinateFrame?: number;
  typeMask?: number;
}


/**
 * Client for sending MAVLink commands to the flight controller
 */
export class MAVLinkCommandClient {
  constructor(private httpClient: HttpClient) {}

  /**
   * Arm the vehicle
   */
  async arm(options: MAVLinkCommandOptions = {}): Promise<MAVLinkCommandResponse> {
    return this.sendCommand({
      commandType: 'arm',
      ...options
    });
  }

  /**
   * Disarm the vehicle
   */
  async disarm(options: MAVLinkCommandOptions = {}): Promise<MAVLinkCommandResponse> {
    return this.sendCommand({
      commandType: 'disarm',
      ...options
    });
  }

  /**
   * Set flight mode
   */
  async setMode(customMode: number | ArduPilotMode, options: Omit<SetModeOptions, 'customMode'> = {}): Promise<MAVLinkCommandResponse> {
    return this.sendCommand({
      commandType: 'setMode',
      customMode: typeof customMode === 'number' ? customMode : customMode,
      ...options
    });
  }

  /**
   * Send a generic COMMAND_LONG message
   */
  async sendCommandLong(options: CommandLongOptions): Promise<MAVLinkCommandResponse> {
    return this.sendCommand({
      commandType: 'commandLong',
      ...options
    });
  }

  /**
   * Send a COMMAND_INT message
   */
  async sendCommandInt(options: CommandIntOptions): Promise<MAVLinkCommandResponse> {
    return this.sendCommand({
      commandType: 'commandInt',
      ...options
    });
  }

  /**
   * Set position target in local NED coordinates
   */
  async setPositionTarget(options: PositionTargetOptions): Promise<MAVLinkCommandResponse> {
    return this.sendCommand({
      commandType: 'setPositionTarget',
      ...options
    });
  }

  /**
   * Request takeoff to specified altitude
   */
  async takeoff(altitude: number, options: MAVLinkCommandOptions = {}): Promise<MAVLinkCommandResponse> {
    return this.sendCommandLong({
      command: MAVCommand.COMPONENT_ARM_DISARM,
      param7: altitude,
      ...options
    });
  }

  /**
   * Return to launch
   */
  async returnToLaunch(options: MAVLinkCommandOptions = {}): Promise<MAVLinkCommandResponse> {
    return this.setMode(ArduPilotMode.RTL, options);
  }

  /**
   * Land the vehicle
   */
  async land(options: MAVLinkCommandOptions = {}): Promise<MAVLinkCommandResponse> {
    return this.setMode(ArduPilotMode.LAND, options);
  }

  /**
   * Set home position to current location
   */
  async setHomeHere(options: MAVLinkCommandOptions = {}): Promise<MAVLinkCommandResponse> {
    return this.sendCommandLong({
      command: MAVCommand.DO_SET_HOME,
      param1: 1, // Use current location
      ...options
    });
  }

  /**
   * Request vehicle capabilities
   */
  async requestCapabilities(options: MAVLinkCommandOptions = {}): Promise<MAVLinkCommandResponse> {
    return this.sendCommandLong({
      command: MAVCommand.REQUEST_AUTOPILOT_CAPABILITIES,
      param1: 1,
      ...options
    });
  }

  /**
   * Send raw MAVLink command
   */
  private async sendCommand(command: any): Promise<MAVLinkCommandResponse> {
    // Set defaults
    const payload = {
      targetSystem: 1,
      targetComponent: 1,
      ...command
    };

    const response = await this.httpClient.post<MAVLinkCommandResponse>('/api/mavlink/command', payload);
    return response;
  }
}
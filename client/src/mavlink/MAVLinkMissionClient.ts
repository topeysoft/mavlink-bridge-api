import { HttpClient } from '../core/HttpClient';
import { WebSocketClient } from '../core/WebSocketClient';
import { EventType } from '../core/EventTypes';
import { MAVLinkCommandOptions } from './MAVLinkTypes';
import { MAVCommand, MAVLinkMessageType } from './MAVLinkTypes';
import {
  MissionItem,
  MissionPlan,
  MissionUploadOptions,
  MissionDownloadOptions,
  MissionStatus,
  MissionProgress,
  MissionOperationResult,
  MissionUploadProgress,
  MissionDownloadProgress,
  MissionState,
  MissionResult,
  MAVFrame,
  MAVMissionType,
  MissionCommandResult,
  CreateWaypointOptions,
  MissionEventPayload,
  WaypointMissionItem
} from './MAVLinkMissionTypes';

export class MAVLinkMissionClient {
  private uploadInProgress = false;
  private downloadInProgress = false;
  private currentMissionStatus: MissionStatus | null = null;

  constructor(
    private httpClient: HttpClient,
    private wsClient?: WebSocketClient
  ) {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (!this.wsClient) return;

    this.wsClient.on(EventType.MISSION_CURRENT, (data: any) => {
      if (this.currentMissionStatus) {
        this.currentMissionStatus.current = data.seq || 0;
      }
    });

    this.wsClient.on(EventType.MISSION_ITEM_REACHED, (data: any) => {
      if (this.currentMissionStatus) {
        this.currentMissionStatus.reached = data.seq || 0;
      }
    });
  }

  async uploadMission(
    missionPlan: MissionPlan,
    options: MissionUploadOptions = {}
  ): Promise<MissionOperationResult> {
    if (this.uploadInProgress) {
      throw new Error('Mission upload already in progress');
    }

    this.uploadInProgress = true;

    try {
      const payload = {
        targetSystem: options.targetSystem || 1,
        targetComponent: options.targetComponent || 1,
        missionType: options.missionType || MAVMissionType.MAV_MISSION_TYPE_MISSION,
        items: missionPlan.items,
        count: missionPlan.items.length
      };

      const response = await this.httpClient.post<MissionOperationResult>(
        '/api/mavlink/mission/upload',
        payload
      );

      return response;
    } finally {
      this.uploadInProgress = false;
    }
  }

  async downloadMission(
    options: MissionDownloadOptions = {}
  ): Promise<MissionPlan> {
    if (this.downloadInProgress) {
      throw new Error('Mission download already in progress');
    }

    this.downloadInProgress = true;

    try {
      const payload = {
        targetSystem: options.targetSystem || 1,
        targetComponent: options.targetComponent || 1,
        missionType: options.missionType || MAVMissionType.MAV_MISSION_TYPE_MISSION
      };

      const response = await this.httpClient.post<{ items: MissionItem[] }>(
        '/api/mavlink/mission/download',
        payload
      );

      return {
        items: response.items,
        targetSystem: payload.targetSystem,
        targetComponent: payload.targetComponent
      };
    } finally {
      this.downloadInProgress = false;
    }
  }

  async clearMission(options: MAVLinkCommandOptions = {}): Promise<MissionOperationResult> {
    const payload = {
      targetSystem: options.targetSystem || 1,
      targetComponent: options.targetComponent || 1,
      missionType: MAVMissionType.MAV_MISSION_TYPE_MISSION
    };

    const response = await this.httpClient.post<MissionOperationResult>(
      '/api/mavlink/mission/clear',
      payload
    );

    return response;
  }

  async startMission(options: MAVLinkCommandOptions = {}): Promise<MissionOperationResult> {
    const payload = {
      commandType: 'commandLong',
      command: MAVCommand.MISSION_START,
      param1: 0,
      param2: 0,
      targetSystem: options.targetSystem || 1,
      targetComponent: options.targetComponent || 1
    };

    const response = await this.httpClient.post<MissionOperationResult>(
      '/api/mavlink/command',
      payload
    );

    return response;
  }

  async pauseMission(options: MAVLinkCommandOptions = {}): Promise<MissionOperationResult> {
    const payload = {
      commandType: 'commandLong',
      command: MAVCommand.DO_SET_MODE,
      param1: 4,
      targetSystem: options.targetSystem || 1,
      targetComponent: options.targetComponent || 1
    };

    const response = await this.httpClient.post<MissionOperationResult>(
      '/api/mavlink/command',
      payload
    );

    return response;
  }

  async resumeMission(options: MAVLinkCommandOptions = {}): Promise<MissionOperationResult> {
    const payload = {
      commandType: 'commandLong',
      command: MAVCommand.DO_SET_MODE,
      param1: 3,
      targetSystem: options.targetSystem || 1,
      targetComponent: options.targetComponent || 1
    };

    const response = await this.httpClient.post<MissionOperationResult>(
      '/api/mavlink/command',
      payload
    );

    return response;
  }

  async setCurrentMissionItem(
    seq: number,
    options: MAVLinkCommandOptions = {}
  ): Promise<MissionOperationResult> {
    const payload = {
      targetSystem: options.targetSystem || 1,
      targetComponent: options.targetComponent || 1,
      seq: seq
    };

    const response = await this.httpClient.post<MissionOperationResult>(
      '/api/mavlink/mission/set_current',
      payload
    );

    return response;
  }

  async requestMissionStatus(options: MAVLinkCommandOptions = {}): Promise<MissionStatus> {
    const payload = {
      targetSystem: options.targetSystem || 1,
      targetComponent: options.targetComponent || 1
    };

    const response = await this.httpClient.post<MissionStatus>(
      '/api/mavlink/mission/status',
      payload
    );

    this.currentMissionStatus = response;
    return response;
  }

  getCurrentMissionStatus(): MissionStatus | null {
    return this.currentMissionStatus;
  }

  createWaypoint(options: CreateWaypointOptions): WaypointMissionItem {
    const item: WaypointMissionItem = {
      seq: options.seq || 0,
      frame: options.frame || MAVFrame.MAV_FRAME_GLOBAL_RELATIVE_ALT_INT,
      command: 16,
      current: 0,
      autocontinue: options.autocontinue ? 1 : 0,
      param1: options.loiterTime || 0,
      param2: options.acceptanceRadius || 0,
      param3: options.passRadius || 0,
      param4: options.yawAngle || 0,
      x: Math.round(options.lat * 1e7),
      y: Math.round(options.lng * 1e7),
      z: options.alt,
      lat: options.lat,
      lng: options.lng,
      alt: options.alt,
      missionType: MAVMissionType.MAV_MISSION_TYPE_MISSION
    };

    return item;
  }

  createTakeoffItem(
    lat: number,
    lng: number,
    alt: number,
    seq: number = 0
  ): MissionItem {
    return {
      seq: seq,
      frame: MAVFrame.MAV_FRAME_GLOBAL_RELATIVE_ALT_INT,
      command: 22,
      current: 0,
      autocontinue: 1,
      param1: 0,
      param2: 0,
      param3: 0,
      param4: 0,
      x: Math.round(lat * 1e7),
      y: Math.round(lng * 1e7),
      z: alt,
      missionType: MAVMissionType.MAV_MISSION_TYPE_MISSION
    };
  }

  createLandItem(
    lat: number,
    lng: number,
    seq: number
  ): MissionItem {
    return {
      seq: seq,
      frame: MAVFrame.MAV_FRAME_GLOBAL_RELATIVE_ALT_INT,
      command: 21,
      current: 0,
      autocontinue: 1,
      param1: 0,
      param2: 0,
      param3: 0,
      param4: 0,
      x: Math.round(lat * 1e7),
      y: Math.round(lng * 1e7),
      z: 0,
      missionType: MAVMissionType.MAV_MISSION_TYPE_MISSION
    };
  }

  createReturnToLaunchItem(seq: number): MissionItem {
    return {
      seq: seq,
      frame: MAVFrame.MAV_FRAME_MISSION,
      command: 20,
      current: 0,
      autocontinue: 1,
      param1: 0,
      param2: 0,
      param3: 0,
      param4: 0,
      x: 0,
      y: 0,
      z: 0,
      missionType: MAVMissionType.MAV_MISSION_TYPE_MISSION
    };
  }

  createLoiterItem(
    lat: number,
    lng: number,
    alt: number,
    radius: number,
    time: number,
    seq: number
  ): MissionItem {
    return {
      seq: seq,
      frame: MAVFrame.MAV_FRAME_GLOBAL_RELATIVE_ALT_INT,
      command: 19,
      current: 0,
      autocontinue: 1,
      param1: time,
      param2: 0,
      param3: radius,
      param4: 0,
      x: Math.round(lat * 1e7),
      y: Math.round(lng * 1e7),
      z: alt,
      missionType: MAVMissionType.MAV_MISSION_TYPE_MISSION
    };
  }

  isUploadInProgress(): boolean {
    return this.uploadInProgress;
  }

  isDownloadInProgress(): boolean {
    return this.downloadInProgress;
  }

  onMissionEvent(handler: (event: MissionEventPayload) => void): () => void {
    if (!this.wsClient) {
      throw new Error('WebSocket client not available for mission events');
    }

    const missionCurrentHandler = (data: any) => {
      handler({
        type: 'mission_current',
        data,
        timestamp: Date.now()
      });
    };

    const missionReachedHandler = (data: any) => {
      handler({
        type: 'mission_item_reached',
        data,
        timestamp: Date.now()
      });
    };

    const missionAckHandler = (data: any) => {
      handler({
        type: 'mission_ack',
        data,
        timestamp: Date.now()
      });
    };

    const missionCountHandler = (data: any) => {
      handler({
        type: 'mission_count',
        data,
        timestamp: Date.now()
      });
    };

    this.wsClient.on(EventType.MISSION_CURRENT, missionCurrentHandler);
    this.wsClient.on(EventType.MISSION_ITEM_REACHED, missionReachedHandler);
    this.wsClient.on(EventType.MISSION_ACK, missionAckHandler);
    this.wsClient.on(EventType.MISSION_COUNT, missionCountHandler);

    return () => {
      this.wsClient?.off(EventType.MISSION_CURRENT, missionCurrentHandler);
      this.wsClient?.off(EventType.MISSION_ITEM_REACHED, missionReachedHandler);
      this.wsClient?.off(EventType.MISSION_ACK, missionAckHandler);
      this.wsClient?.off(EventType.MISSION_COUNT, missionCountHandler);
    };
  }

  onMissionProgress(handler: (progress: MissionProgress) => void): () => void {
    if (!this.wsClient) {
      throw new Error('WebSocket client not available for mission progress');
    }

    const progressHandler = (data: any) => {
      const progress: MissionProgress = {
        totalItems: data.totalItems || 0,
        currentItem: data.currentItem || 0,
        itemsReached: data.itemsReached || 0,
        distanceToWaypoint: data.distanceToWaypoint,
        estimatedTimeToWaypoint: data.estimatedTimeToWaypoint
      };
      handler(progress);
    };

    this.wsClient.on(EventType.MISSION_PROGRESS, progressHandler);

    return () => {
      this.wsClient?.off(EventType.MISSION_PROGRESS, progressHandler);
    };
  }
}
export interface RTCMConfig {
  enabled: boolean;
  source: NTRIPSource | TCPSource | UDPSource;
  outputFormat: 'raw' | 'mavlink';
}

export interface NTRIPSource {
  type: 'ntrip';
  host: string;
  port: number;
  mountpoint: string;
  username?: string;
  password?: string;
  sendPosition?: boolean;
  position?: {
    latitude: number;
    longitude: number;
    altitude: number;
  };
}

export interface TCPSource {
  type: 'tcp';
  host: string;
  port: number;
}

export interface UDPSource {
  type: 'udp';
  port: number;
  remoteHost?: string;
  remotePort?: number;
}

export enum RTCMState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error'
}

export interface RTCMStatistics {
  messagesReceived: number;
  bytesReceived: number;
  crcErrors: number;
  dataRate: number;
  lastMessageTime: number;
  messageTypes: { [key: string]: number };
}

export interface RTCMStatus {
  running: boolean;
  state?: RTCMState;
  statistics?: RTCMStatistics;
  uptime?: number;
  clientType?: string;
}

export interface RTCMDataEvent {
  type: 'rtcm_data';
  messageType: number;
  messageName: string;
  length: number;
  stationId?: number;
}

export interface RTCMStateChangeEvent {
  state: number;
  stateName: string;
}

export interface RTCMResponse {
  success: boolean;
  message?: string;
  error?: string;
  errors?: { [key: string]: string };
}
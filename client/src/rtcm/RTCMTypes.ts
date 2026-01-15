export interface RTCMOutputTarget {
  name: string;
  enabled: boolean;
  format: 'raw' | 'mavlink';
  transport: SerialTransportConfig | TCPTransportConfig | UDPTransportConfig;
}

export interface SerialTransportConfig {
  type: 'serial';
  port: string;
  baudrate: number;
}

export interface TCPTransportConfig {
  type: 'tcp';
  host: string;
  port: number;
}

export interface UDPTransportConfig {
  type: 'udp';
  host: string;
  port: number;
}

export interface RTCMConfig {
  enabled: boolean;
  source: NTRIPSource | TCPSource | UDPSource;
  outputFormat: 'raw' | 'mavlink';
  outputs?: RTCMOutputTarget[];
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

export interface RTCMOutputTargetStats {
  name: string;
  messagesSent: number;
  bytesSent: number;
  sendErrors: number;
  lastSendTime: number | null;
  isActive: boolean;

  // Support snake_case from backend
  messages_sent?: number;
  bytes_sent?: number;
  send_errors?: number;
  last_send_time?: number | null;
  is_active?: boolean;
}

export interface RTCMStatistics {
  messagesReceived: number;
  bytesReceived: number;
  crcErrors: number;
  dataRate: number;
  lastMessageTime: number;
  messageTypes: { [key: string]: number };
  messagesSent?: number;
  bytesSent?: number;
  errors?: number;
  connectionTime?: number;

  // Parser diagnostics (support both snake_case from backend and camelCase)
  parserBufferSize?: number;
  parser_buffer_size?: number;
  framesWithNoPreamble?: number;
  frames_with_no_preamble?: number;
  framesWithInvalidCrc?: number;
  frames_with_invalid_crc?: number;
  framesWithInvalidLength?: number;
  frames_with_invalid_length?: number;

  // Output router statistics
  outputTargets?: RTCMOutputTargetStats[];
  output_targets?: RTCMOutputTargetStats[];
  totalTargets?: number;
  total_targets?: number;
  activeTargets?: number;
  active_targets?: number;
  routingErrors?: number;
  routing_errors?: number;
}

export interface RTCMStatus {
  running: boolean;
  state?: RTCMState;
  statistics?: RTCMStatistics;
  uptime?: number;
  clientType: string;  // Connection type: "NTRIP", "TCP", or "UDP"
  connected?: boolean;
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
/**
 * Communication interface types
 */
export enum Interface {
  NONE = 'none',
  USB_OTG = 'usb_otg',
  UART = 'uart'
}

/**
 * Data routing modes
 */
export enum RoutingMode {
  AUTO = 'auto',
  USB_PRIORITY = 'usb_priority',
  UART_ONLY = 'uart_only',
  USB_ONLY = 'usb_only'
}

/**
 * Interface change event
 */
export interface InterfaceChangeEvent {
  from: Interface;
  to: Interface;
  reason: string;
  timestamp: number;
}

/**
 * Data flow statistics
 */
export interface DataFlowStats {
  interface: Interface;
  upstreamRate: number;  // bytes/sec
  downstreamRate: number;
  packetsReceived: number;
  packetsSent: number;
  bytesReceived: number;
  bytesSent: number;
  interfaceSwitches: number;
  lastSwitchMs: number;
}

/**
 * Communication system statistics
 */
export interface CommunicationStats {
  activeInterface: Interface;
  routingMode: RoutingMode;
  dataFlow: DataFlowStats;
  usb: USBStats;
  uart: UARTStats;
  mavlink: MAVLinkStats;
}

/**
 * USB interface statistics
 */
export interface USBStats {
  connected: boolean;
  state: 'not_initialized' | 'initialized' | 'connected' | 'suspended' | 'error';
  bytesReceived: number;
  bytesSent: number;
  packetsReceived: number;
  packetsSent: number;
  dataRate: number;
}

/**
 * UART interface statistics
 */
export interface UARTStats {
  connected: boolean;
  baudRate: number;
  bytesReceived: number;
  bytesSent: number;
  packetsReceived: number;
  packetsSent: number;
  dataRate: number;
  crcErrors: number;
  framingErrors: number;
  mavlinkDetected: boolean;
}

/**
 * MAVLink processor statistics
 */
export interface MAVLinkStats {
  totalMessages: number;
  crcErrors: number;
  parseErrors: number;
  sequenceErrors: number;
  messageTypes: Record<number, number>;
  processingEnabled: boolean;
  filterEnabled: boolean;
}

/**
 * MAVLink message filter
 */
export interface MAVLinkFilter {
  allowedMessageIds: number[];
  allowedSystemIds: number[];
  allowedComponentIds: number[];
  enableFilter: boolean;
}

/**
 * MAVLink message
 */
export interface MAVLinkMessage {
  messageId: number;
  messageName?: string; // Optional message name from backend (e.g., "HEARTBEAT", "EKF_STATUS_REPORT")
  systemId: number;
  componentId: number;
  sequence: number;
  length: number;
  payload: any; // Decoded MAVLink message payload (object) or base64 string
  timestamp: number;
  valid: boolean;
}

/**
 * Communication configuration
 */
export interface CommunicationConfig {
  routingMode: RoutingMode;
  preferredInterface: Interface;
  mavlinkProcessing: boolean;
  mavlinkFilter: MAVLinkFilter;
  usb: {
    enabled: boolean;
  };
  uart: {
    enabled: boolean;
    baudRate: number;
    autoBaud: boolean;
    flowControl: boolean;
    rxPin: number;
    txPin: number;
    rtsPin?: number;
    ctsPin?: number;
  };
}

/**
 * Communication system status
 */
export interface CommunicationStatus {
  initialized: boolean;
  activeInterface: Interface;
  routingMode: RoutingMode;
  interfacesAvailable: Interface[];
  lastActivity: number;
  uptime: number;
}

/**
 * Communication error types
 */
export enum CommunicationErrorType {
  INTERFACE_ERROR = 'interface_error',
  ROUTING_ERROR = 'routing_error',
  MAVLINK_ERROR = 'mavlink_error',
  CONFIGURATION_ERROR = 'configuration_error'
}

/**
 * Communication error
 */
export interface CommunicationError {
  type: CommunicationErrorType;
  message: string;
  interface?: Interface;
  timestamp: number;
  details?: Record<string, unknown>;
}

/**
 * Event callbacks
 */
export type InterfaceChangeCallback = (event: InterfaceChangeEvent) => void;
export type DataFlowCallback = (stats: DataFlowStats) => void;
export type MAVLinkMessageCallback = (message: MAVLinkMessage) => void;
export type CommunicationErrorCallback = (error: CommunicationError) => void;
export type StatisticsCallback = (stats: CommunicationStats) => void;
export type DeviceType = "light" | "fan" | "plug" | "other";

export type DeviceMode = "direct" | "gateway";

export type PowerState = "on" | "off" | "unknown";

export type ConnectionState = "connected" | "offline" | "checking";

export type TimerAction = "on" | "off";

/**
 * What the user asked for, as saved in the database. This is NOT proof that
 * the timer is running; the ESP32 `/status` response is the source of truth.
 */
export interface DeviceTimerConfig {
  action: TimerAction;
  seconds: number;
  repeat: boolean;
  startedAt: string;
}

/** Timer block of the ESP32 `/status` response. */
export interface DeviceTimerStatus {
  active: boolean;
  action?: TimerAction;
  repeat?: boolean;
  seconds?: number;
  remaining?: number;
}

export interface DeviceStatusResponse {
  success: boolean;
  deviceId: string;
  reachable: boolean;
  power?: PowerState;
  timer?: DeviceTimerStatus;
  espDevice?: string;
  uptime?: number;
  rssi?: number;
  fetchedAt: string;
  message?: string;
}

export interface DeviceTimerResponse {
  success: boolean;
  deviceId: string;
  reachable: boolean;
  timer?: DeviceTimerStatus;
  targetUrl: string;
  message: string;
}

export interface Device {
  id: string;
  name: string;
  room: string;
  type: DeviceType;
  mode: DeviceMode;
  ip: string;
  relay: number;
  icon?: string;
  powerState: PowerState;
  connectionState: ConnectionState;
  lastSeen?: string;
  timer?: DeviceTimerConfig | null;
}

export interface NetworkConfig {
  name: string;
  subnet: string;
  gateway: string;
  mode: DeviceMode;
  gatewayIp: string;
  gatewayPort: number;
  timeoutMs: number;
}

export interface DeviceControlRequest {
  deviceId: string;
  action: "on" | "off" | "toggle";
}

export interface DeviceControlResponse {
  success: boolean;
  deviceId: string;
  powerState: PowerState;
  connectionState: ConnectionState;
  modeUsed: DeviceMode;
  targetUrl: string;
  message: string;
  timestamp: string;
  simulated?: boolean;
}

export interface TestConnectionResponse {
  success: boolean;
  deviceId: string;
  deviceName: string;
  ip: string;
  mode: DeviceMode;
  reachable: boolean;
  responseTimeMs?: number;
  message: string;
  targetUrl: string;
  details?: string;
  simulated?: boolean;
}

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info" | "warning";
  title: string;
  description?: string;
}

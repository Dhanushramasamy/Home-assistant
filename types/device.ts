export type DeviceType = "light" | "fan" | "plug" | "other";

export type DeviceMode = "direct" | "gateway";

export type PowerState = "on" | "off" | "unknown";

export type ConnectionState = "connected" | "offline" | "checking";

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

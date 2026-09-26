export type DeviceType = "light" | "fan" | "plug" | "other";

export type DeviceMode = "direct" | "gateway";

export type PowerState = "on" | "off" | "unknown";

export type ConnectionState = "connected" | "offline" | "checking";

export type TimerAction = "on" | "off";

/**
 * What the user asked for, as saved in the database. This is NOT proof that
 * the timer is running; the ESP32 `/status` response is the source of truth.
 * `espId` is the id the ESP32 returned when the timer was created.
 */
export interface DeviceTimerConfig {
  /** Row id in device_timer_PRB_home_assistant, when stored there. */
  recordId?: string;
  espId?: number;
  action: TimerAction;
  seconds: number;
  repeat: boolean;
  startedAt: string;
}

/** Most timers one ESP32 runs at once (firmware limit). */
export const MAX_ESP_TIMERS = 10;
/** Longest timer the firmware accepts, in seconds (24 h). */
export const MAX_TIMER_SECONDS = 86400;

/**
 * What the ESP32's timer firmware supports:
 * - "full": timers have an id and an action (ON/OFF later, repeat, cancel one).
 *   Firmware announces it with `"timerApi": 2` in /status.
 * - "basic": older firmware; a timer turns the relay ON now and OFF after N s,
 *   has no id, and can only be cancelled per relay. The app won't create timers.
 */
export type TimerMode = "full" | "basic";

/** One running timer, as reported by the ESP32. */
export interface DeviceTimerEntry {
  /** ESP32 timer id. Basic firmware has no ids; those get negative placeholders. */
  id: number;
  active: boolean;
  /** Relay the timer switches (firmware without relays: 1). */
  relay: number;
  action: TimerAction;
  repeat: boolean;
  seconds: number;
  remaining: number;
}

export interface DeviceStatusResponse {
  success: boolean;
  deviceId: string;
  reachable: boolean;
  power?: PowerState;
  timers?: DeviceTimerEntry[];
  timerMode?: TimerMode;
  timerCount?: number;
  relay?: number;
  ip?: string;
  ssid?: string;
  espDevice?: string;
  uptime?: number;
  rssi?: number;
  /** Timers the DB still has as scheduled (after reconciling, if reachable). */
  savedTimers?: DeviceTimerConfig[];
  fetchedAt: string;
  message?: string;
}

export interface DeviceTimerResponse {
  success: boolean;
  deviceId: string;
  reachable: boolean;
  /** The timer that was created (start) */
  created?: DeviceTimerEntry;
  /** Timers still running on the device after the call, when known */
  timers?: DeviceTimerEntry[];
  /** Why it failed, for the UI: offline | invalid | not_found | limit | error */
  reason?: "offline" | "invalid" | "not_found" | "limit" | "unsupported" | "error";
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
  /** Timers the user configured (see DeviceTimerConfig). */
  timers?: DeviceTimerConfig[];
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

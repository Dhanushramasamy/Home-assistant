"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Device, DeviceTimerEntry, PowerState, TimerAction } from "@/types";
import { Lightbulb, Fan, Plug, Cpu, ArrowUpRight, Timer, Repeat } from "lucide-react";
import { formatCountdown, remainingNow } from "@/lib/timerClient";
import { useNow } from "@/lib/useNow";
import { Device3DModal } from "./Device3DModal";
import { PowerPill } from "./ui/PowerPill";
import { easeApple, springs } from "@/lib/deviceTheme";

/** Last ESP32 /status result for a device, kept by the page. */
export interface EspStatusEntry {
  reachable: boolean;
  /** Timers the ESP32 reported as running at `syncedAt` (empty when offline). */
  timers: DeviceTimerEntry[];
  timerCount?: number;
  /** Firmware device name, e.g. "ESP200". */
  espDevice?: string;
  rssi?: number;
  uptime?: number;
  ssid?: string;
  syncedAt: number;
}

interface DeviceCardProps {
  device: Device;
  onTogglePower: (deviceId: string, currentPower: PowerState) => void;
  onTestConnection: (deviceId: string) => void;
  /** Admin only; hidden for other users. */
  onEditDevice?: (device: Device) => void;
  onDeleteDevice?: (device: Device) => void;
  isActionLoading?: boolean;
  /** Position in the grid, used to stagger the entrance. */
  index?: number;
  espStatus?: EspStatusEntry;
  onRefreshStatus?: (deviceId: string) => Promise<void>;
  onStartTimer?: (deviceId: string, action: TimerAction, seconds: number, repeat: boolean) => Promise<void>;
  onCancelTimer?: (deviceId: string, timerId: number) => Promise<void>;
  onClearTimers?: (deviceId: string) => Promise<void>;
}

export const deviceIcons = { light: Lightbulb, fan: Fan, plug: Plug, other: Cpu };

export const DeviceCard: React.FC<DeviceCardProps> = ({
  device,
  onTogglePower,
  onTestConnection,
  onEditDevice,
  onDeleteDevice,
  isActionLoading = false,
  index = 0,
  espStatus,
  onRefreshStatus,
  onStartTimer,
  onCancelTimer,
  onClearTimers,
}) => {
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const isOn = device.powerState === "on";
  const isConnected = espStatus ? espStatus.reachable : device.connectionState === "connected";
  const savedCount = device.timers?.length ?? 0;
  const Icon = deviceIcons[device.type] ?? Cpu;
  const toggle = () => !isActionLoading && onTogglePower(device.id, device.powerState);
  const timers = espStatus?.timers ?? [];
  const now = useNow(timers.length > 0);
  // Show the timer that fires next; "+N" for the rest.
  const next = timers
    .map((t) => ({ t, left: remainingNow(t, espStatus?.syncedAt ?? 0, now) }))
    .sort((a, b) => a.left - b.left)[0];

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
        transition={{ duration: 0.55, ease: easeApple, delay: Math.min(index * 0.05, 0.35) }}
      >
        <motion.div
          whileHover={{ y: -3 }}
          transition={springs.soft}
          className="glass relative flex h-full flex-col gap-5 overflow-hidden rounded-[28px] p-3"
        >
          {/* Soft lime glow when the device is on */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full bg-accent blur-3xl"
            initial={false}
            animate={{ opacity: isOn ? 0.14 : 0, scale: isOn ? 1 : 0.5 }}
            transition={{ duration: 0.7, ease: easeApple }}
          />

          <div className="relative flex items-start justify-between">
            <motion.div
              initial={false}
              animate={{ scale: isOn ? [1, 1.12, 1] : 1 }}
              transition={{ duration: 0.45, ease: easeApple }}
              className="glass-btn relative flex h-12 w-12 items-center justify-center rounded-full"
            >
              <motion.span
                className="flex"
                animate={device.type === "fan" && isOn ? { rotate: 360 } : { rotate: 0 }}
                transition={device.type === "fan" && isOn ? { duration: 1.6, repeat: Infinity, ease: "linear" } : { duration: 0.8 }}
              >
                <Icon
                  className="h-5 w-5 transition-colors duration-300"
                  style={{ color: isOn ? "#e8f047" : "#d4d4d8", filter: isOn ? "drop-shadow(0 0 6px rgb(232 240 71 / 0.6))" : "none" }}
                  strokeWidth={1.8}
                />
              </motion.span>
            </motion.div>

            <motion.button
              onClick={() => setIsDetailOpen(true)}
              whileHover={{ rotate: 45 }}
              whileTap={{ scale: 0.9 }}
              transition={springs.snappy}
              className="glass-btn flex h-12 w-12 items-center justify-center rounded-full text-ink"
              aria-label={`Open ${device.name}`}
            >
              <ArrowUpRight className="h-5 w-5" strokeWidth={1.8} />
            </motion.button>
          </div>

          <div className="relative min-w-0 px-1">
            <p className="flex items-center gap-1.5 truncate text-[13px] text-muted">
              {!isConnected && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger" title="No response" />}
              {device.room}
            </p>
            <h3 className="mt-0.5 line-clamp-2 text-[18px] font-medium leading-snug text-ink">{device.name}</h3>
            <AnimatePresence initial={false}>
              {next && (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1 text-[12px] font-medium text-accent"
                >
                  {next.t.repeat ? <Repeat className="h-3 w-3" /> : <Timer className="h-3 w-3" />}
                  {next.t.action === "on" ? "On" : "Off"} in <span className="tabular-nums">{formatCountdown(next.left)}</span>
                  {timers.length > 1 && <span className="opacity-70">+{timers.length - 1}</span>}
                </motion.p>
              )}
              {!next && espStatus && !espStatus.reachable && savedCount > 0 && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-[12px] text-muted"
                  title="Saved in the app; can't confirm on the device while it's offline"
                >
                  <Timer className="h-3 w-3" />
                  {savedCount} saved · offline
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <div className="relative mt-auto flex justify-end">
            <PowerPill
              on={isOn}
              onToggle={toggle}
              disabled={isActionLoading}
              unavailable={!!espStatus && !espStatus.reachable}
              label={`${device.name} power`}
            />
          </div>
        </motion.div>
      </motion.div>

      <Device3DModal
        device={device}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onTogglePower={onTogglePower}
        onTestConnection={onTestConnection}
        onEditDevice={onEditDevice}
        onDeleteDevice={onDeleteDevice}
        espStatus={espStatus}
        onRefreshStatus={onRefreshStatus}
        onStartTimer={onStartTimer}
        onCancelTimer={onCancelTimer}
        onClearTimers={onClearTimers}
      />
    </>
  );
};

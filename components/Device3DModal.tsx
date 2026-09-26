"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Device, MAX_ESP_TIMERS, MAX_TIMER_SECONDS, PowerState, TimerAction } from "@/types";
import { Dynamic3DCanvas } from "./3d/Dynamic3DCanvas";
import {
  ChevronLeft,
  MoreVertical,
  Activity,
  Pencil,
  Trash2,
  Lightbulb,
  Fan,
  Plug,
  Cpu,
  Wifi,
  WifiOff,
  CircuitBoard,
  Server,
  Loader2,
  X,
  Timer as TimerIcon,
  Repeat,
  type LucideIcon,
} from "lucide-react";
import { ModalShell } from "./ui/ModalShell";
import { PowerPill } from "./ui/PowerPill";
import { Switch } from "./ui/Switch";
import { Button } from "./ui/Button";
import type { EspStatusEntry } from "./DeviceCard";
import { easeApple, springs } from "@/lib/deviceTheme";
import { formatCountdown, formatDuration, remainingNow, secondsUntilClock } from "@/lib/timerClient";
import { useNow } from "@/lib/useNow";

interface Device3DModalProps {
  device: Device | null;
  isOpen: boolean;
  onClose: () => void;
  onTogglePower: (deviceId: string, currentPower: PowerState) => void;
  onTestConnection?: (deviceId: string) => void;
  onEditDevice?: (device: Device) => void;
  onDeleteDevice?: (device: Device) => void;
  espStatus?: EspStatusEntry;
  onRefreshStatus?: (deviceId: string) => Promise<void>;
  onStartTimer?: (deviceId: string, action: TimerAction, seconds: number, repeat: boolean) => Promise<void>;
  onCancelTimer?: (deviceId: string, timerId: number) => Promise<void>;
  onClearTimers?: (deviceId: string) => Promise<void>;
}

const icons = { light: Lightbulb, fan: Fan, plug: Plug, other: Cpu };

// Quick picks for the "After" duration. Any custom hours/minutes also work.
const quickDurations = [
  { label: "10m", seconds: 10 * 60 },
  { label: "30m", seconds: 30 * 60 },
  { label: "1h", seconds: 60 * 60 },
  { label: "2h", seconds: 2 * 60 * 60 },
];

// Re-sync with the ESP32 this often while the sheet is open (countdown ticks locally).
const SYNC_MS = 15_000;

export const Device3DModal: React.FC<Device3DModalProps> = ({
  device,
  isOpen,
  onClose,
  onTogglePower,
  onTestConnection,
  onEditDevice,
  onDeleteDevice,
  espStatus,
  onRefreshStatus,
  onStartTimer,
  onCancelTimer,
  onClearTimers,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [timerAction, setTimerAction] = useState<TimerAction>("off");
  const [timerMode, setTimerMode] = useState<"after" | "at">("after");
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("10");
  const [secondsField, setSecondsField] = useState("0");
  const [atTime, setAtTime] = useState("22:00");
  const [repeat, setRepeat] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState<number | "all" | null>(null);

  const deviceId = device?.id;
  const timers = espStatus?.timers ?? [];
  const now = useNow(isOpen && timers.length > 0);
  // Running timers with their local countdown, soonest first.
  const running = timers
    .map((t) => ({ t, left: remainingNow(t, espStatus?.syncedAt ?? 0, now) }))
    .sort((a, b) => a.left - b.left);
  const slotsFull = timers.length >= MAX_ESP_TIMERS;
  // Older firmware: timers have no ids, can only be cancelled per relay, and
  // creating one would switch the relay ON right away, so the form is hidden.
  const basicTimers = espStatus?.reachable === true && espStatus.timerMode === "basic";
  const offline = !!espStatus && !espStatus.reachable;
  const savedTimers = device?.timers ?? [];

  // Seconds sent to the ESP32: a custom duration, or the time until a clock time.
  const clock = useNow(isOpen && timerMode === "at");
  const durationSeconds = (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60 + (Number(secondsField) || 0);
  const timerSeconds = timerMode === "at" ? secondsUntilClock(atTime, clock) : durationSeconds;
  const useRepeat = repeat && timerMode === "after";
  const timerValid = Number.isInteger(timerSeconds) && timerSeconds >= 1 && timerSeconds <= MAX_TIMER_SECONDS;
  const setDuration = (secs: number) => {
    setHours(String(Math.floor(secs / 3600)));
    setMinutes(String(Math.floor((secs % 3600) / 60)));
    setSecondsField(String(secs % 60));
  };

  // Sync with the ESP32 when the sheet opens, then every 30 s while it stays open.
  useEffect(() => {
    if (!isOpen || !deviceId || !onRefreshStatus) return;
    void onRefreshStatus(deviceId);
    const id = setInterval(() => void onRefreshStatus(deviceId), SYNC_MS);
    return () => clearInterval(id);
  }, [isOpen, deviceId, onRefreshStatus]);

  // When any one-shot timer reaches zero, re-check so power + timers come from the ESP32.
  const expired = isOpen && running.some(({ t, left }) => !t.repeat && left === 0);
  useEffect(() => {
    if (!expired || !deviceId || !onRefreshStatus) return;
    const id = setTimeout(() => void onRefreshStatus(deviceId), 2000);
    return () => clearTimeout(id);
  }, [expired, deviceId, onRefreshStatus]);

  const isOn = device?.powerState === "on";
  const Icon = icons[device?.type ?? "other"] ?? Cpu;
  const has3D = device?.type === "light" || device?.type === "fan";
  const isConnected = espStatus ? espStatus.reachable : device?.connectionState === "connected";

  const startTimer = async () => {
    if (!device || !onStartTimer || !timerValid) return;
    setBusy(true);
    await onStartTimer(device.id, timerAction, timerSeconds, useRepeat);
    setBusy(false);
  };
  const cancelTimer = async (timerId: number) => {
    if (!device || !onCancelTimer) return;
    setCancelling(timerId);
    await onCancelTimer(device.id, timerId);
    setCancelling(null);
  };
  const clearTimers = async () => {
    if (!device || !onClearTimers) return;
    setCancelling("all");
    await onClearTimers(device.id);
    setCancelling(null);
  };

  const menuItems = device
    ? [
        onTestConnection && { label: "Test Connection", icon: Activity, danger: false, action: () => onTestConnection(device.id) },
        onEditDevice && { label: "Edit", icon: Pencil, danger: false, action: () => onEditDevice(device) },
        onDeleteDevice && { label: "Delete", icon: Trash2, danger: true, action: () => onDeleteDevice(device) },
      ].filter(Boolean) as { label: string; icon: LucideIcon; danger: boolean; action: () => void }[]
    : [];

  const stagger = (i: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: easeApple, delay: 0.08 + i * 0.06 },
  });

  return (
    <ModalShell isOpen={isOpen && !!device} onClose={onClose} className="max-w-md">
      {device && (
        <div className="overflow-y-auto">
          {/* Header */}
          <div className="relative flex items-center justify-between px-5 pt-5">
            <button onClick={onClose} className="glass-btn flex h-12 w-12 items-center justify-center rounded-full" aria-label="Back">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0 px-3 text-center">
              <h3 className="truncate text-[22px] font-medium">{device.name}</h3>
              <p className="text-[14px] text-muted">{device.room}</p>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="glass-btn flex h-12 w-12 items-center justify-center rounded-full"
                aria-label="More"
              >
                <MoreVertical className="h-5 w-5" />
              </button>
              <AnimatePresence>
                {showMenu && menuItems.length > 0 && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.92, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.94 }}
                      transition={{ duration: 0.18, ease: easeApple }}
                      style={{ transformOrigin: "top right" }}
                      className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-2xl border border-white/10 bg-[#26272c]/95 py-1 text-[14px] shadow-2xl backdrop-blur-xl"
                    >
                      {menuItems.map((item) => (
                        <button
                          key={item.label}
                          onClick={() => {
                            setShowMenu(false);
                            if (item.label !== "Test Connection") onClose();
                            item.action();
                          }}
                          className={`flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-white/[0.06] ${
                            item.danger ? "text-danger" : "text-ink"
                          }`}
                        >
                          <span>{item.label}</span>
                          <item.icon className="h-4 w-4 opacity-70" />
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="px-5 pt-5">
            <PowerPill
              on={isOn}
              onToggle={() => onTogglePower(device.id, device.powerState)}
              unavailable={offline}
              size="lg"
              label="Power"
            />
          </div>

          {/* Visual */}
          <motion.div {...stagger(0)} className="relative -mt-6 px-2">
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-x-16 bottom-4 top-16 rounded-full bg-accent blur-[70px]"
              initial={false}
              animate={{ opacity: isOn ? 0.2 : 0 }}
              transition={{ duration: 0.6 }}
            />
            {has3D ? (
              <Dynamic3DCanvas type={device.type} isOn={isOn} value={100} />
            ) : (
              <div className="flex h-60 items-center justify-center">
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={() => onTogglePower(device.id, device.powerState)}
                  className="glass-btn flex h-32 w-32 items-center justify-center rounded-full"
                  aria-label="Toggle power"
                >
                  <Icon
                    className="h-12 w-12 transition-colors duration-300"
                    style={{ color: isOn ? "#e8f047" : "#71717a", filter: isOn ? "drop-shadow(0 0 14px rgb(232 240 71 / 0.7))" : "none" }}
                    strokeWidth={1.5}
                  />
                </motion.button>
              </div>
            )}
          </motion.div>

          <div className="space-y-3 px-5 pb-6">
            {/* Device info tiles */}
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: "Status",
                  value: isConnected ? "Online" : "No Response",
                  icon: isConnected ? Wifi : WifiOff,
                  tone: isConnected ? "#e8f047" : "#f87171",
                },
                { label: "Relay", value: `${device.relay}`, icon: CircuitBoard, tone: "#d4d4d8" },
                {
                  label: "Connection",
                  value: device.mode === "gateway" ? "Gateway" : "Direct",
                  icon: device.mode === "gateway" ? Server : Wifi,
                  tone: "#d4d4d8",
                },
              ].map((t, i) => (
                <motion.div
                  key={t.label}
                  {...stagger(1 + i * 0.5)}
                  className="glass flex flex-col items-center rounded-[28px] px-2 py-4 text-center"
                >
                  <span className="glass-btn flex h-11 w-11 items-center justify-center rounded-full">
                    <t.icon className="h-5 w-5" style={{ color: t.tone }} strokeWidth={1.8} />
                  </span>
                  <span className="mt-2 text-[12px] text-muted">{t.label}</span>
                  <span className="mt-0.5 max-w-full truncate text-[15px] font-medium sm:text-[17px]" style={{ color: t.label === "Status" && !isConnected ? "#f87171" : undefined }}>
                    {t.value}
                  </span>
                </motion.div>
              ))}
            </div>

            {/* IP + live test */}
            <motion.div {...stagger(2.5)} className="glass flex items-center justify-between gap-3 rounded-[28px] px-5 py-3.5">
              <div className="min-w-0">
                <p className="text-[13px] text-muted">IP Address</p>
                <p className="truncate font-mono text-[16px]">{device.ip}</p>
                {espStatus?.reachable && (espStatus.ssid || espStatus.rssi !== undefined || espStatus.uptime !== undefined) && (
                  <p className="mt-0.5 truncate text-[12px] text-muted">
                    {[
                      espStatus.ssid,
                      espStatus.rssi !== undefined ? `${espStatus.rssi} dBm` : null,
                      espStatus.uptime !== undefined ? `up ${formatDuration(espStatus.uptime >= 60 ? Math.floor(espStatus.uptime / 60) * 60 : Math.floor(espStatus.uptime))}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
              {onTestConnection && (
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={() => onTestConnection(device.id)}
                  className="glass-btn flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-[15px]"
                >
                  <Activity className="h-4 w-4 text-accent" />
                  Test
                </motion.button>
              )}
            </motion.div>

            {/* Timers (run on the ESP32; several can run at once) */}
            {onStartTimer && (
              <motion.div {...stagger(3)} className="glass space-y-4 rounded-[28px] px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[17px]">Timers</p>
                    {offline && (
                      <p className="text-[12px] text-danger">
                        {espStatus?.espDevice ?? device.name} is offline. Running timers can&apos;t be confirmed.
                      </p>
                    )}
                  </div>
                  {!offline && (
                    <span className="pt-1 text-[13px] text-muted">
                      {espStatus ? `${running.length} of ${MAX_ESP_TIMERS} running` : "Checking device…"}
                    </span>
                  )}
                </div>

                {/* Running timers */}
                <AnimatePresence initial={false}>
                  {running.map(({ t, left }) => (
                    <motion.div
                      key={t.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 24 }}
                      transition={{ duration: 0.25, ease: easeApple }}
                      className="flex items-center justify-between gap-3 rounded-[20px] bg-white/[0.05] px-4 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="glass-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                          {t.repeat ? <Repeat className="h-4 w-4 text-accent" /> : <TimerIcon className="h-4 w-4 text-accent" />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[13px] text-muted">
                            {t.id >= 0 ? `Timer #${t.id} · ` : "Timer · "}
                            <span className="text-ink">Turn {t.action.toUpperCase()}</span>
                          </p>
                          <p className="mt-0.5 text-[22px] font-medium leading-none tabular-nums text-accent" aria-label="Remaining">
                            {formatCountdown(left)}
                          </p>
                          <p className="mt-1 truncate text-[12px] text-muted">
                            {t.repeat ? `Repeating every ${formatDuration(t.seconds)}` : "One-time"}
                          </p>
                        </div>
                      </div>
                      {!basicTimers && (
                      <button
                        onClick={() => cancelTimer(t.id)}
                        disabled={cancelling !== null}
                        className="glass-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-danger disabled:opacity-40"
                        aria-label={`Cancel timer ${t.id}`}
                      >
                        {cancelling === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                      </button>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Offline: what the app saved, clearly not "running" */}
                {offline && savedTimers.length > 0 && (
                  <div className="space-y-2 rounded-[20px] border border-dashed border-white/10 px-4 py-3">
                    <p className="text-[12px] text-muted">Saved in the app · not confirmed on the device</p>
                    {savedTimers.map((t, i) => (
                      <p key={t.recordId ?? `${t.espId}-${i}`} className="text-[14px] text-dim">
                        {t.espId !== undefined ? `#${t.espId} · ` : ""}Turn {t.action.toUpperCase()}{" "}
                        {t.repeat ? `every ${formatDuration(t.seconds)}` : `after ${formatDuration(t.seconds)}`}
                      </p>
                    ))}
                  </div>
                )}

                {(running.length > 1 || (basicTimers && running.length > 0)) && onClearTimers && (
                  <button
                    onClick={clearTimers}
                    disabled={cancelling !== null}
                    className="text-[13px] text-danger disabled:opacity-40"
                  >
                    {cancelling === "all" ? "Cancelling…" : basicTimers ? "Cancel Timers on This Relay" : "Cancel All Timers"}
                  </button>
                )}

                {running.length > 0 && <div className="h-px bg-line" />}

                {/* New timer (only on firmware that supports it) */}
                {basicTimers ? (
                  <div className="rounded-[20px] border border-dashed border-white/10 px-4 py-3 text-[13px] leading-relaxed text-muted">
                    New timers need a firmware update on {espStatus?.espDevice ?? device.name}. Its current firmware
                    would switch the relay ON straight away, so the app won&apos;t create timers until it&apos;s updated.
                    Running timers still show here.
                  </div>
                ) : (
                <>
                    <p className="text-[13px] text-muted">
                      {slotsFull
                        ? `Maximum of ${MAX_ESP_TIMERS} timers are already active on this device.`
                        : !timerValid
                          ? "Duration must be between 1 second and 24 hours."
                          : timerMode === "at"
                            ? `Turn ${timerAction.toUpperCase()} at ${atTime} · in ${formatDuration(Math.round(timerSeconds / 60) * 60)}`
                            : `Turn ${timerAction.toUpperCase()} ${useRepeat ? "every" : "after"} ${formatDuration(timerSeconds)}`}
                    </p>

                  {/* Action */}
                  <div className="grid grid-cols-2 gap-1 rounded-full bg-white/[0.05] p-1">
                    {(["on", "off"] as const).map((a) => (
                      <button
                        key={a}
                        onClick={() => setTimerAction(a)}
                        className={`relative h-10 rounded-full text-[14px] ${timerAction === a ? "text-[#151515]" : "text-ink"}`}
                      >
                        {timerAction === a && (
                          <motion.span layoutId={`timer-action-${device.id}`} transition={springs.snappy} className="absolute inset-0 rounded-full bg-white" />
                        )}
                        <span className="relative">Turn {a === "on" ? "On" : "Off"}</span>
                      </button>
                    ))}
                  </div>

                  {/* When: after a duration, or at a clock time */}
                  <div className="grid grid-cols-2 gap-1 rounded-full bg-white/[0.05] p-1">
                    {(
                      [
                        { id: "after", label: "After" },
                        { id: "at", label: "At time" },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setTimerMode(m.id)}
                        className={`relative h-9 rounded-full text-[13px] ${timerMode === m.id ? "text-ink" : "text-muted"}`}
                      >
                        {timerMode === m.id && (
                          <motion.span layoutId={`timer-mode-${device.id}`} transition={springs.snappy} className="absolute inset-0 rounded-full bg-white/[0.14]" />
                        )}
                        <span className="relative">{m.label}</span>
                      </button>
                    ))}
                  </div>

                  {timerMode === "after" ? (
                    <>
                      <div className="grid grid-cols-4 gap-2">
                        {quickDurations.map((t) => {
                          const active = durationSeconds === t.seconds;
                          return (
                            <button
                              key={t.label}
                              onClick={() => setDuration(t.seconds)}
                              className={`relative h-10 rounded-full text-[14px] ${active ? "text-[#151515]" : "bg-white/[0.05] text-ink"}`}
                            >
                              {active && (
                                <motion.span layoutId={`timer-${device.id}`} transition={springs.snappy} className="absolute inset-0 rounded-full bg-accent" />
                              )}
                              <span className="relative">{t.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Custom duration */}
                      <div className="flex items-center gap-2">
                        {[
                          { label: "h", value: hours, set: setHours, max: 24 },
                          { label: "min", value: minutes, set: setMinutes, max: 59 },
                          { label: "s", value: secondsField, set: setSecondsField, max: 59 },
                        ].map((f) => (
                          <label key={f.label} className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-2">
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={f.max}
                              value={f.value}
                              onChange={(e) => f.set(e.target.value.replace(/\D/g, "").slice(0, 2))}
                              aria-label={f.label === "h" ? "Hours" : f.label === "min" ? "Minutes" : "Seconds"}
                              className="w-full bg-transparent text-right text-[17px] tabular-nums text-ink focus:outline-none"
                            />
                            <span className="text-[14px] text-muted">{f.label}</span>
                          </label>
                        ))}
                      </div>

                      {/* Repeat */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[15px]">Repeat</p>
                          <p className="text-[12px] text-muted">
                            Turn {timerAction.toUpperCase()} every {timerValid ? formatDuration(timerSeconds) : "…"}
                          </p>
                        </div>
                        <Switch checked={repeat} onChange={() => setRepeat(!repeat)} label="Repeat timer" />
                      </div>
                    </>
                  ) : (
                    <label className="flex items-center justify-between rounded-full bg-white/[0.05] px-5 py-2">
                      <span className="text-[15px]">Time</span>
                      <input
                        type="time"
                        value={atTime}
                        onChange={(e) => setAtTime(e.target.value)}
                        className="bg-transparent text-right text-[17px] tabular-nums text-ink [color-scheme:dark] focus:outline-none"
                        aria-label="Time of day"
                      />
                    </label>
                  )}

                  <Button onClick={startTimer} disabled={busy || !timerValid || slotsFull || offline} className="w-full py-3 text-[15px]">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : running.length > 0 ? "Add Timer" : "Start Timer"}
                  </Button>
                </>
                )}
              </motion.div>
            )}
          </div>
        </div>
      )}
    </ModalShell>
  );
};

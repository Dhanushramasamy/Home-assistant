"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Device, PowerState } from "@/types";
import { Dynamic3DCanvas } from "./3d/Dynamic3DCanvas";
import {
  ChevronLeft,
  MoreVertical,
  Minus,
  Plus,
  Sun,
  Moon,
  Palette,
  BookOpen,
  Wind,
  Leaf,
  Zap,
  Activity,
  Pencil,
  Trash2,
  Lightbulb,
  Fan,
  Plug,
  Cpu,
  type LucideIcon,
} from "lucide-react";
import { ModalShell } from "./ui/ModalShell";
import { PowerPill } from "./ui/PowerPill";
import { RollingNumber } from "./ui/RollingNumber";
import { easeApple, springs } from "@/lib/deviceTheme";

interface Device3DModalProps {
  device: Device | null;
  isOpen: boolean;
  onClose: () => void;
  onTogglePower: (deviceId: string, currentPower: PowerState) => void;
  onTestConnection?: (deviceId: string) => void;
  onEditDevice?: (device: Device) => void;
  onDeleteDevice?: (device: Device) => void;
}

const icons = { light: Lightbulb, fan: Fan, plug: Plug, other: Cpu };

const modesByType: Partial<Record<Device["type"], { id: string; label: string; icon: LucideIcon }[]>> = {
  light: [
    { id: "light", label: "Light", icon: Sun },
    { id: "night", label: "Night", icon: Moon },
    { id: "color", label: "Color", icon: Palette },
    { id: "reading", label: "Reading", icon: BookOpen },
  ],
  fan: [
    { id: "normal", label: "Normal", icon: Wind },
    { id: "sleep", label: "Sleep", icon: Moon },
    { id: "breeze", label: "Breeze", icon: Leaf },
    { id: "turbo", label: "Turbo", icon: Zap },
  ],
};

const TIMER_MS = 60 * 60 * 1000;
const MIN = 10;

export const Device3DModal: React.FC<Device3DModalProps> = ({
  device,
  isOpen,
  onClose,
  onTogglePower,
  onTestConnection,
  onEditDevice,
  onDeleteDevice,
}) => {
  const [controlValue, setControlValue] = useState<number>(60); // Brightness or speed, 10-100
  const [activeMode, setActiveMode] = useState<string>("");
  const [showMenu, setShowMenu] = useState(false);
  const [timerAt, setTimerAt] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const powerRef = useRef<PowerState | undefined>(device?.powerState);

  useEffect(() => {
    powerRef.current = device?.powerState;
  }, [device?.powerState]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const isOn = device?.powerState === "on";
  const Icon = icons[device?.type ?? "other"] ?? Cpu;
  const modes = modesByType[device?.type ?? "other"] ?? [];
  const mode = activeMode || modes[0]?.id;
  const hasLevel = device?.type === "light" || device?.type === "fan";
  const pct = ((controlValue - MIN) / (100 - MIN)) * 100;

  // Client-side timer: flips the device once after an hour while the app is open.
  const toggleTimer = () => {
    if (!device) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      setTimerAt(null);
      return;
    }
    timerRef.current = setTimeout(() => {
      onTogglePower(device.id, powerRef.current ?? device.powerState);
      timerRef.current = null;
      setTimerAt(null);
    }, TIMER_MS);
    setTimerAt(new Date(Date.now() + TIMER_MS));
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
            <PowerPill on={isOn} onToggle={() => onTogglePower(device.id, device.powerState)} size="lg" label="Power" />
          </div>

          {/* Visual */}
          <motion.div {...stagger(0)} className="relative -mt-6 px-2">
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-x-16 bottom-4 top-16 rounded-full bg-accent blur-[70px]"
              initial={false}
              animate={{ opacity: isOn ? 0.08 + controlValue / 700 : 0 }}
              transition={{ duration: 0.6 }}
            />
            {hasLevel ? (
              <Dynamic3DCanvas type={device.type} isOn={isOn} value={controlValue} />
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
            {/* Level */}
            {hasLevel && (
              <motion.div {...stagger(1)} className={`glass rounded-[28px] p-4 transition-opacity ${isOn ? "" : "opacity-50"}`}>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => isOn && setControlValue(MIN)}
                    className="h-11 w-11 shrink-0 rounded-full bg-[#3b3d24]"
                    aria-label="Minimum"
                  />
                  <input
                    type="range"
                    min={MIN}
                    max={100}
                    step={5}
                    value={controlValue}
                    disabled={!isOn}
                    onChange={(e) => setControlValue(Number(e.target.value))}
                    className="slider flex-1"
                    style={{ "--range-pct": `${pct}%` } as React.CSSProperties}
                    aria-label={device.type === "fan" ? "Fan speed" : "Brightness"}
                  />
                  <motion.button
                    onClick={() => isOn && setControlValue(100)}
                    animate={{ boxShadow: isOn ? `0 0 ${8 + controlValue / 4}px rgb(232 240 71 / 0.6)` : "none" }}
                    className="h-11 w-11 shrink-0 rounded-full bg-accent"
                    aria-label="Maximum"
                  />
                </div>
                <div className="mt-4 flex justify-center">
                  <div className="glass-btn flex items-center gap-4 rounded-full p-1.5">
                    <button
                      onClick={() => setControlValue((v) => Math.max(MIN, v - 10))}
                      disabled={!isOn || controlValue <= MIN}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] disabled:opacity-40"
                      aria-label="Decrease"
                    >
                      <Minus className="h-5 w-5" />
                    </button>
                    <span className="min-w-[4ch] text-center text-[28px] font-medium tabular-nums">
                      <RollingNumber value={controlValue} />%
                    </span>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setControlValue((v) => Math.min(100, v + 10))}
                      disabled={!isOn || controlValue >= 100}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#151515] disabled:opacity-40"
                      aria-label="Increase"
                    >
                      <Plus className="h-5 w-5" />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Modes */}
            {modes.length > 0 && (
              <motion.div {...stagger(2)} className="glass flex items-center gap-2 rounded-full p-1.5">
                {modes.map((m) => {
                  const active = mode === m.id;
                  return (
                    <motion.button
                      layout
                      key={m.id}
                      onClick={() => setActiveMode(m.id)}
                      transition={springs.snappy}
                      className={`relative flex h-12 items-center justify-center gap-2 rounded-full ${active ? "flex-1 px-5" : "w-12 shrink-0"}`}
                      aria-label={m.label}
                    >
                      {active && (
                        <motion.span
                          layoutId={`mode-${device.id}`}
                          transition={springs.snappy}
                          className="absolute inset-0 rounded-full border border-white/10 bg-white/[0.1]"
                        />
                      )}
                      {!active && <span className="absolute inset-0 rounded-full bg-white/[0.04]" />}
                      <m.icon className="relative h-5 w-5" style={{ color: active ? "#e8f047" : "#d4d4d8" }} />
                      {active && (
                        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative text-[15px]">
                          {m.label}
                        </motion.span>
                      )}
                    </motion.button>
                  );
                })}
              </motion.div>
            )}

            {/* Timer */}
            <motion.div {...stagger(3)} className="glass flex items-center justify-between gap-3 rounded-[28px] px-5 py-4">
              <div className="min-w-0">
                <p className="text-[17px]">Timer</p>
                <p className="truncate text-[13px] text-muted">
                  {timerAt
                    ? `${isOn ? "Turns off" : "Turns on"} at ${timerAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                    : `After 1 hour turn ${isOn ? "off" : "on"}`}
                </p>
              </div>
              <PowerPill on={!!timerAt} onToggle={toggleTimer} label="Timer" />
            </motion.div>
          </div>
        </div>
      )}
    </ModalShell>
  );
};

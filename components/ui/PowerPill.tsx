"use client";

import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Power } from "lucide-react";
import { springs } from "@/lib/deviceTheme";
import { playSwitchClick } from "@/lib/sound";

interface PowerPillProps {
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
  size?: "md" | "lg";
  label?: string;
  /** Play the click sound on toggle (default true). */
  sound?: boolean;
  /** Real state unknown (device unreachable): show "—" and disable. */
  unavailable?: boolean;
}

/**
 * Glass pill toggle: "On" + glowing lime knob when on,
 * white knob + "Off" when off. The knob slides across on toggle.
 */
export const PowerPill: React.FC<PowerPillProps> = ({ on: onProp, onToggle, disabled, size = "md", label, sound = true, unavailable = false }) => {
  const on = onProp && !unavailable;
  const knob = size === "lg" ? "h-12 w-12" : "h-10 w-10";
  const icon = size === "lg" ? "h-5 w-5" : "h-[18px] w-[18px]";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={unavailable ? "mixed" : on}
      aria-label={unavailable ? `${label ?? "Power"} unavailable` : label}
      title={unavailable ? "Device unreachable, state unknown" : undefined}
      disabled={disabled || unavailable}
      onClick={(e) => {
        e.stopPropagation();
        if (sound) playSwitchClick(!on);
        onToggle();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className={`glass-btn flex shrink-0 items-center gap-1 rounded-full p-1 disabled:opacity-40 ${
        on ? "flex-row" : "flex-row-reverse"
      }`}
    >
      <motion.span layout transition={springs.snappy} className={`relative flex items-center justify-center overflow-hidden ${size === "lg" ? "w-11" : "w-9"}`}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={unavailable ? "na" : on ? "on" : "off"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className={`text-[15px] ${on ? "text-ink" : "text-muted"}`}
          >
            {unavailable ? "—" : on ? "On" : "Off"}
          </motion.span>
        </AnimatePresence>
      </motion.span>
      <motion.span
        layout
        transition={springs.snappy}
        className={`relative flex items-center justify-center rounded-full ${knob}`}
        style={{
          background: unavailable ? "#52525b" : on ? "#e8f047" : "#f4f4f5",
          boxShadow: on ? "0 0 18px 2px rgb(232 240 71 / 0.45)" : "0 2px 8px rgb(0 0 0 / 0.35)",
        }}
      >
        <motion.span
          initial={false}
          animate={{ rotate: on ? 0 : -90 }}
          transition={springs.soft}
          className="flex"
        >
          <Power className={`${icon} text-[#151515]`} strokeWidth={2.4} />
        </motion.span>
      </motion.span>
    </button>
  );
};

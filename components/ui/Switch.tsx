"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import { springs } from "@/lib/deviceTheme";

interface SwitchProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  /** Track colour when on. Defaults to the lime accent. */
  color?: string;
  label?: string;
}

/** iOS-style switch: 51×31 track, spring knob that stretches while pressed. */
export const Switch: React.FC<SwitchProps> = ({ checked, onChange, disabled, color = "#e8f047", label }) => {
  const [pressed, setPressed] = useState(false);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        setPressed(true);
      }}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      className={`relative flex h-[31px] w-[51px] shrink-0 items-center rounded-full p-[2px] transition-colors duration-300 disabled:opacity-40 ${
        checked ? "justify-end" : "justify-start"
      }`}
      style={{ backgroundColor: checked ? color : "rgb(255 255 255 / 0.16)" }}
    >
      <motion.span
        layout
        animate={{ width: pressed ? 33 : 27 }}
        transition={springs.snappy}
        className="h-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)]"
      />
    </button>
  );
};

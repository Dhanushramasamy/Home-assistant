import { DeviceType } from "@/types";

// Tint per device type (used in the type picker); "on" state everywhere uses ACCENT.
export const deviceAccent: Record<DeviceType, { hex: string; rgb: string; light: string; label: string }> = {
  light: { hex: "#e8f047", rgb: "232 240 71", light: "#f4f8a0", label: "Light" },
  fan: { hex: "#7dd3fc", rgb: "125 211 252", light: "#bae6fd", label: "Fan" },
  plug: { hex: "#86efac", rgb: "134 239 172", light: "#bbf7d0", label: "Plug" },
  other: { hex: "#f0abfc", rgb: "240 171 252", light: "#f5d0fe", label: "Other" },
};

export const ACCENT = { hex: "#e8f047", rgb: "232 240 71" };

// Apple's standard sheet curve, plus springs for small controls.
export const easeApple = [0.32, 0.72, 0, 1] as const;

export const springs = {
  snappy: { type: "spring", stiffness: 500, damping: 38 },
  soft: { type: "spring", stiffness: 300, damping: 34 },
  gentle: { type: "spring", stiffness: 200, damping: 30 },
} as const;

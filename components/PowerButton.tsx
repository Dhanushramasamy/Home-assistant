"use client";

import React from "react";
import { Power, Loader2 } from "lucide-react";
import { PowerState } from "@/types";

interface PowerButtonProps {
  powerState: PowerState;
  isLoading?: boolean;
  onToggle: () => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  fullWidth?: boolean;
}

export const PowerButton: React.FC<PowerButtonProps> = ({
  powerState,
  isLoading = false,
  onToggle,
  disabled = false,
  size = "lg",
  fullWidth = true,
}) => {
  const isOn = powerState === "on";

  const buttonSizes = {
    sm: "px-3.5 py-1.5 text-xs rounded-xl gap-1.5",
    md: "px-5 py-2.5 text-sm rounded-xl gap-2",
    lg: "px-6 py-3 text-base rounded-2xl gap-2.5",
    xl: "px-7 py-3.5 text-lg rounded-2xl gap-3",
  };

  const iconSizes = {
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-5 h-5",
    xl: "w-6 h-6",
  };

  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`relative inline-flex items-center justify-center font-extrabold tracking-wide transition-all duration-200 select-none cursor-pointer border overflow-hidden active:scale-95 ${
        fullWidth ? "w-full" : ""
      } ${buttonSizes[size]} ${
        isOn
          ? "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-500/25 scale-[1.01]"
          : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/90 shadow-2xs"
      } ${disabled ? "opacity-60 cursor-not-allowed transform-none shadow-none" : ""}`}
    >
      {/* Background Pulse Animation when ON */}
      {isOn && (
        <span className="absolute inset-0 bg-white/15 animate-pulse pointer-events-none" />
      )}

      {isLoading ? (
        <>
          <Loader2 className={`${iconSizes[size]} animate-spin text-current`} />
          <span className="text-xs sm:text-sm">{isOn ? "Turning OFF..." : "Turning ON..."}</span>
        </>
      ) : (
        <>
          <Power
            className={`${iconSizes[size]} transition-transform duration-200 ${
              isOn ? "text-white scale-110 drop-shadow-xs" : "text-slate-400"
            }`}
          />
          <span className="flex items-center space-x-2 relative z-10">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                isOn
                  ? "bg-white shadow-[0_0_8px_#ffffff]"
                  : "bg-slate-400"
              }`}
            />
            <span className="text-base sm:text-lg font-black tracking-wider">
              {isOn ? "TURNED ON" : "TURNED OFF"}
            </span>
          </span>
        </>
      )}
    </button>
  );
};

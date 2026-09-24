"use client";

import React from "react";
import { Power, Loader2 } from "lucide-react";
import { PowerState } from "@/types";

interface PowerButtonProps {
  powerState: PowerState;
  isLoading?: boolean;
  onToggle: () => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
}

export const PowerButton: React.FC<PowerButtonProps> = ({
  powerState,
  isLoading = false,
  onToggle,
  disabled = false,
  size = "md",
}) => {
  const isOn = powerState === "on";

  const buttonSizes = {
    sm: "px-3.5 py-1.5 text-xs rounded-xl gap-1.5",
    md: "px-5 py-2.5 text-sm rounded-xl gap-2 min-w-[110px]",
    lg: "px-7 py-3.5 text-base rounded-2xl gap-2.5 min-w-[140px]",
  };

  const iconSizes = {
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <button
      onClick={onToggle}
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center font-semibold tracking-wide transition-all duration-200 select-none cursor-pointer border ${
        buttonSizes[size]
      } ${
        isOn
          ? "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-400 shadow-sm shadow-emerald-500/20 active:scale-95"
          : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 shadow-2xs active:scale-95"
      } ${disabled ? "opacity-60 cursor-not-allowed transform-none shadow-none" : ""}`}
    >
      {isLoading ? (
        <>
          <Loader2 className={`${iconSizes[size]} animate-spin text-current`} />
          <span className="text-xs">{isOn ? "Turning OFF..." : "Turning ON..."}</span>
        </>
      ) : (
        <>
          <Power className={`${iconSizes[size]} ${isOn ? "text-white" : "text-slate-500"}`} />
          <span className="flex items-center space-x-1.5">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                isOn ? "bg-white" : "bg-slate-400"
              }`}
            />
            <span>{isOn ? "ON" : "OFF"}</span>
          </span>
        </>
      )}
    </button>
  );
};

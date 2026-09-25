"use client";

import React, { useState } from "react";
import { Device, PowerState } from "@/types";
import { Dynamic3DCanvas } from "./3d/Dynamic3DCanvas";
import { X, Sun, Moon, Minus, Plus, Sparkles, Sliders, Wind, Zap } from "lucide-react";

interface Device3DModalProps {
  device: Device | null;
  isOpen: boolean;
  onClose: () => void;
  onTogglePower: (deviceId: string, currentPower: PowerState) => void;
}

export const Device3DModal: React.FC<Device3DModalProps> = ({
  device,
  isOpen,
  onClose,
  onTogglePower,
}) => {
  const [controlValue, setControlValue] = useState<number>(80); // Brightness 0-100% or Speed
  const [activeMode, setActiveMode] = useState<"normal" | "accent" | "turbo">("normal");

  if (!isOpen || !device) return null;

  const isOn = device.powerState === "on";

  const handleDecrease = () => {
    setControlValue((prev) => Math.max(10, prev - 10));
  };

  const handleIncrease = () => {
    setControlValue((prev) => Math.min(100, prev + 10));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-100 flex flex-col font-sans">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/60">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">{device.name}</h3>
            <p className="text-[11px] text-slate-400 font-medium">{device.room}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3D Canvas Container */}
        <div className="p-4 sm:p-5 relative bg-radial from-slate-800/40 via-slate-900 to-slate-950">
          <Dynamic3DCanvas type={device.type} isOn={isOn} value={controlValue} />

          {/* Floating Power Toggle Pill */}
          <button
            onClick={() => onTogglePower(device.id, device.powerState)}
            className={`absolute top-8 right-8 px-4 py-2 rounded-full font-bold text-xs shadow-lg transition-all flex items-center space-x-2 border ${
              isOn
                ? "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-400 shadow-emerald-500/30"
                : "bg-slate-800/90 hover:bg-slate-700 text-slate-300 border-slate-700"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isOn ? "bg-white animate-pulse" : "bg-slate-500"}`} />
            <span>{isOn ? "POWER ON" : "POWER OFF"}</span>
          </button>
        </div>

        {/* Interactive Controls Panel (Reflects Reference Design) */}
        <div className="p-6 bg-slate-900 space-y-5 border-t border-slate-800">
          
          {/* Mode Selector Presets */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => setActiveMode("normal")}
              className={`flex items-center justify-center space-x-2 p-3 rounded-2xl border text-xs font-bold transition-all ${
                activeMode === "normal"
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs"
                  : "bg-slate-800/60 text-slate-400 border-slate-800 hover:bg-slate-800"
              }`}
            >
              <Sun className="w-4 h-4 text-amber-400" />
              <span>Normal Mode</span>
            </button>

            <button
              onClick={() => setActiveMode("accent")}
              className={`flex items-center justify-center space-x-2 p-3 rounded-2xl border text-xs font-bold transition-all ${
                activeMode === "accent"
                  ? "bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-xs"
                  : "bg-slate-800/60 text-slate-400 border-slate-800 hover:bg-slate-800"
              }`}
            >
              <Sparkles className="w-4 h-4 text-sky-400" />
              <span>Color Accent</span>
            </button>
          </div>

          {/* Dial / Slider Value Display */}
          <div className="p-5 rounded-3xl bg-slate-950/70 border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 flex items-center space-x-1.5">
                {device.type === "fan" ? <Wind className="w-4 h-4 text-sky-400" /> : <Zap className="w-4 h-4 text-amber-400" />}
                <span>{device.type === "fan" ? "Fan Airflow Speed" : "Light Intensity"}</span>
              </span>
              <span className="text-xl font-extrabold text-amber-400 tracking-tight">
                {controlValue}%
              </span>
            </div>

            {/* Slider */}
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={controlValue}
              onChange={(e) => setControlValue(Number(e.target.value))}
              disabled={!isOn}
              className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 disabled:opacity-40"
            />

            {/* Plus / Minus Quick Buttons */}
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={handleDecrease}
                disabled={!isOn || controlValue <= 10}
                className="w-10 h-10 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 flex items-center justify-center font-bold border border-slate-700 transition-colors"
              >
                <Minus className="w-4 h-4" />
              </button>

              <span className="text-[11px] font-semibold text-slate-500">
                {isOn ? "Adjust level in real-time" : "Turn device ON to adjust"}
              </span>

              <button
                onClick={handleIncrease}
                disabled={!isOn || controlValue >= 100}
                className="w-10 h-10 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 flex items-center justify-center font-bold border border-slate-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

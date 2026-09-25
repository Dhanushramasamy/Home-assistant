"use client";

import React, { useState } from "react";
import { Device, PowerState } from "@/types";
import { PowerButton } from "./PowerButton";
import {
  Lightbulb,
  Fan,
  Plug,
  Cpu,
  MoreVertical,
  Activity,
  Trash2,
  Edit3,
  Box,
  Sparkles,
} from "lucide-react";
import { Device3DModal } from "./Device3DModal";

interface DeviceCardProps {
  device: Device;
  onTogglePower: (deviceId: string, currentPower: PowerState) => void;
  onTestConnection: (deviceId: string) => void;
  onEditDevice: (device: Device) => void;
  onDeleteDevice: (device: Device) => void;
  isActionLoading?: boolean;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({
  device,
  onTogglePower,
  onTestConnection,
  onEditDevice,
  onDeleteDevice,
  isActionLoading = false,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [is3DModalOpen, setIs3DModalOpen] = useState(false);

  const isOn = device.powerState === "on";
  const isConnected = device.connectionState === "connected";

  const renderIcon = () => {
    switch (device.type) {
      case "light":
        return (
          <Lightbulb
            className={`w-6 h-6 transition-colors ${
              isOn ? "text-amber-500" : "text-slate-400"
            }`}
          />
        );
      case "fan":
        return (
          <Fan
            className={`w-6 h-6 transition-colors ${
              isOn ? "text-sky-500 animate-spin" : "text-slate-400"
            }`}
          />
        );
      case "plug":
        return (
          <Plug
            className={`w-6 h-6 transition-colors ${
              isOn ? "text-emerald-500" : "text-slate-400"
            }`}
          />
        );
      default:
        return (
          <Cpu
            className={`w-6 h-6 transition-colors ${
              isOn ? "text-purple-500" : "text-slate-400"
            }`}
          />
        );
    }
  };

  const getPastelBg = () => {
    if (!isOn) return "bg-white border-slate-200/90";
    switch (device.type) {
      case "light":
        return "bg-amber-50/70 border-amber-200/80";
      case "fan":
        return "bg-sky-50/70 border-sky-200/80";
      case "plug":
        return "bg-emerald-50/70 border-emerald-200/80";
      default:
        return "bg-purple-50/70 border-purple-200/80";
    }
  };

  return (
    <>
      <div
        className={`relative flex flex-col justify-between h-full p-4 sm:p-5 rounded-3xl border transition-all duration-200 shadow-2xs hover:shadow-md ${getPastelBg()}`}
      >
        {/* Top Header Bar: Device Icon + Compact Name Label + Status Pill + Menu */}
        <div className="flex items-start justify-between gap-2 mb-3">
          {/* Icon & Compact Name Label */}
          <div className="flex items-center space-x-2.5 min-w-0 flex-1">
            <button
              onClick={() => setIs3DModalOpen(true)}
              className={`w-10 h-10 rounded-2xl flex items-center justify-center border shrink-0 transition-all hover:scale-105 active:scale-95 ${
                isOn
                  ? device.type === "light"
                    ? "bg-amber-100 border-amber-300 shadow-xs"
                    : device.type === "fan"
                    ? "bg-sky-100 border-sky-300 shadow-xs"
                    : "bg-emerald-100 border-emerald-300 shadow-xs"
                  : "bg-slate-100 border-slate-200"
              }`}
              title="Click to open 3D Interactive Controls"
            >
              {renderIcon()}
            </button>

            <div className="min-w-0 flex-1">
              {/* Small Compact Device Name Label */}
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight truncate leading-tight">
                {device.name}
              </h3>
              <p className="text-[10px] text-slate-500 flex items-center space-x-1 mt-0.5 truncate">
                <span className="px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600 font-medium shrink-0">
                  {device.room}
                </span>
                <span>•</span>
                <span className="capitalize truncate">
                  {device.mode === "gateway" ? "Pi 5" : "ESP32"}
                </span>
              </p>
            </div>
          </div>

          {/* Right side: Status Pill, 3D Button & Context Menu */}
          <div className="flex items-center space-x-1 shrink-0 pt-0.5">
            <button
              onClick={() => setIs3DModalOpen(true)}
              className="px-2 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-800 text-[10px] font-bold flex items-center space-x-1 transition-all"
              title="Interactive 3D Mode"
            >
              <Box className="w-3 h-3 text-amber-400" />
              <span className="hidden sm:inline">3D</span>
            </button>

            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                isConnected
                  ? "bg-emerald-100/90 text-emerald-800 border-emerald-200"
                  : "bg-rose-100/90 text-rose-800 border-rose-200"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full mr-1 ${
                  isConnected ? "bg-emerald-500" : "bg-rose-500"
                }`}
              />
              {isConnected ? "Online" : "Offline"}
            </span>

            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 py-1 text-xs">
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        setIs3DModalOpen(true);
                      }}
                      className="flex items-center w-full px-3 py-2 text-slate-800 font-semibold hover:bg-slate-50 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-2 text-amber-500" />
                      <span>Open 3D Controls</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onTestConnection(device.id);
                      }}
                      className="flex items-center w-full px-3 py-2 text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Activity className="w-3.5 h-3.5 mr-2 text-sky-600" />
                      <span>Test Connection</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onEditDevice(device);
                      }}
                      className="flex items-center w-full px-3 py-2 text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5 mr-2 text-indigo-600" />
                      <span>Edit Device</span>
                    </button>

                    <div className="my-1 border-t border-slate-100" />

                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onDeleteDevice(device);
                      }}
                      className="flex items-center w-full px-3 py-2 text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-2" />
                      <span>Delete Device</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Main Bottom Section: BIG Prominent Power Toggle Button */}
        <div className="mt-3 pt-2 border-t border-slate-200/60">
          <PowerButton
            powerState={device.powerState}
            isLoading={isActionLoading}
            onToggle={() => onTogglePower(device.id, device.powerState)}
            size="lg"
            fullWidth
          />
        </div>
      </div>

      {/* Interactive 3D Modal */}
      <Device3DModal
        device={device}
        isOpen={is3DModalOpen}
        onClose={() => setIs3DModalOpen(false)}
        onTogglePower={onTogglePower}
      />
    </>
  );
};

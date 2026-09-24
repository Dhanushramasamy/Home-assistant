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
  Wifi,
  Trash2,
  Edit3,
} from "lucide-react";

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
    <div
      className={`relative flex flex-col justify-between p-5 rounded-2xl border transition-all duration-200 shadow-2xs hover:shadow-md ${getPastelBg()}`}
    >
      {/* Top Bar: Icon + Connection Badge + Menu */}
      <div className="flex items-center justify-between mb-3">
        {/* Device Icon */}
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center border transition-all ${
            isOn
              ? device.type === "light"
                ? "bg-amber-100 border-amber-200"
                : device.type === "fan"
                ? "bg-sky-100 border-sky-200"
                : "bg-emerald-100 border-emerald-200"
              : "bg-slate-100 border-slate-200"
          }`}
        >
          {renderIcon()}
        </div>

        <div className="flex items-center space-x-1.5">
          {/* Connection Status Pill */}
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${
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
            {isConnected ? "Connected" : "Offline"}
          </span>

          {/* Context Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 text-xs">
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

      {/* Middle: Device Name & Room */}
      <div className="my-1">
        <h3 className="text-base font-bold text-slate-900 tracking-tight truncate">
          {device.name}
        </h3>
        <p className="text-xs text-slate-500 flex items-center space-x-1.5 mt-0.5">
          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-medium">
            {device.room}
          </span>
          <span>•</span>
          <span className="capitalize text-[11px] text-slate-500">
            {device.mode === "gateway" ? "Pi Gateway" : "Direct ESP32"}
          </span>
        </p>
      </div>

      {/* Bottom: Power Button */}
      <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between">
        <div className="text-xs">
          <span className="block text-[10px] uppercase font-bold text-slate-400">
            Status
          </span>
          <span
            className={`font-extrabold uppercase text-xs ${
              isOn ? "text-emerald-700" : "text-slate-500"
            }`}
          >
            {device.powerState}
          </span>
        </div>

        <PowerButton
          powerState={device.powerState}
          isLoading={isActionLoading}
          onToggle={() => onTogglePower(device.id, device.powerState)}
          size="md"
        />
      </div>
    </div>
  );
};

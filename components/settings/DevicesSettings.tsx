"use client";

import React from "react";
import { Device } from "@/types";
import {
  Lightbulb,
  Fan,
  Plug,
  Cpu,
  Plus,
  Activity,
  Edit3,
  Trash2,
  Wifi,
  Server,
} from "lucide-react";

interface DevicesSettingsProps {
  devices: Device[];
  onOpenAddModal: () => void;
  onEditDevice: (device: Device) => void;
  onDeleteDevice: (device: Device) => void;
  onTestConnection: (deviceId: string) => void;
}

export const DevicesSettings: React.FC<DevicesSettingsProps> = ({
  devices,
  onOpenAddModal,
  onEditDevice,
  onDeleteDevice,
  onTestConnection,
}) => {
  const renderIcon = (type: Device["type"]) => {
    switch (type) {
      case "light":
        return <Lightbulb className="w-4 h-4 text-amber-600" />;
      case "fan":
        return <Fan className="w-4 h-4 text-sky-600" />;
      case "plug":
        return <Plug className="w-4 h-4 text-emerald-600" />;
      default:
        return <Cpu className="w-4 h-4 text-purple-600" />;
    }
  };

  return (
    <div className="space-y-4">
      
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900">Device Settings</h3>
          <p className="text-xs text-slate-500">
            Edit technical IP parameters and test connectivity
          </p>
        </div>
        <button
          onClick={onOpenAddModal}
          className="flex items-center space-x-1 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Device</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {devices.map((device) => {
          const isConnected = device.connectionState === "connected";
          return (
            <div
              key={device.id}
              className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200">
                    {renderIcon(device.type)}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{device.name}</h4>
                    <p className="text-[11px] text-slate-500">
                      {device.room} • <span className="capitalize">{device.type}</span> (Relay {device.relay || 1})
                    </p>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    isConnected
                      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                      : "bg-rose-100 text-rose-800 border-rose-200"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full mr-1 ${
                      isConnected ? "bg-emerald-500" : "bg-rose-500"
                    }`}
                  />
                  {isConnected ? "Connected" : "Offline"}
                </span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>IP Address</span>
                  <span className="font-mono text-teal-700 font-bold bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    {device.ip}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span>Communication</span>
                  <span className="flex items-center text-slate-800 font-medium">
                    {device.mode === "gateway" ? (
                      <>
                        <Server className="w-3 h-3 mr-1 text-purple-600" />
                        <span>Pi Gateway</span>
                      </>
                    ) : (
                      <>
                        <Wifi className="w-3 h-3 mr-1 text-sky-600" />
                        <span>Direct ESP32</span>
                      </>
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => onTestConnection(device.id)}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-sky-700 text-xs font-semibold transition-colors border border-slate-200"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Test Connection</span>
                </button>

                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => onEditDevice(device)}
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors border border-slate-200"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => onDeleteDevice(device)}
                    className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors border border-rose-200"
                    title="Delete Device"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};

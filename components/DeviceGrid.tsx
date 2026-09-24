"use client";

import React from "react";
import { Device, PowerState } from "@/types";
import { DeviceCard } from "./DeviceCard";
import { Home, Plus, SearchX, Sparkles } from "lucide-react";

interface DeviceGridProps {
  devices: Device[];
  selectedRoom: string;
  searchQuery: string;
  onTogglePower: (deviceId: string, currentPower: PowerState) => void;
  onTestConnection: (deviceId: string) => void;
  onEditDevice: (device: Device) => void;
  onDeleteDevice: (device: Device) => void;
  onOpenAddModal: () => void;
  onLoadSampleData?: () => void;
  loadingDeviceIds: Set<string>;
}

export const DeviceGrid: React.FC<DeviceGridProps> = ({
  devices,
  selectedRoom,
  searchQuery,
  onTogglePower,
  onTestConnection,
  onEditDevice,
  onDeleteDevice,
  onOpenAddModal,
  onLoadSampleData,
  loadingDeviceIds,
}) => {
  const filteredDevices = devices.filter((device) => {
    const matchesRoom =
      selectedRoom === "All" ||
      device.room.toLowerCase() === selectedRoom.toLowerCase();

    const matchesSearch =
      !searchQuery ||
      device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.room.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.type.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesRoom && matchesSearch;
  });

  if (filteredDevices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl bg-white border border-slate-200 shadow-2xs">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3 border border-slate-200">
          <SearchX className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-1">
          {devices.length === 0 ? "No devices added yet" : "No matching devices"}
        </h3>
        <p className="text-xs text-slate-500 max-w-sm mb-6">
          {devices.length === 0
            ? "Add your real ESP32 smart home devices with their local IP address, or load sample devices to explore."
            : searchQuery
            ? `No devices matching "${searchQuery}" in ${selectedRoom}.`
            : `There are no devices configured for ${selectedRoom}.`}
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={onOpenAddModal}
            className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-xs active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Real Device</span>
          </button>

          {onLoadSampleData && devices.length === 0 && (
            <button
              onClick={onLoadSampleData}
              className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-semibold text-xs active:scale-95 transition-all"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Load Sample Setup</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  if (selectedRoom !== "All") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
        {filteredDevices.map((device) => (
          <DeviceCard
            key={device.id}
            device={device}
            onTogglePower={onTogglePower}
            onTestConnection={onTestConnection}
            onEditDevice={onEditDevice}
            onDeleteDevice={onDeleteDevice}
            isActionLoading={loadingDeviceIds.has(device.id)}
          />
        ))}
      </div>
    );
  }

  const groupedRooms = filteredDevices.reduce<Record<string, Device[]>>(
    (acc, device) => {
      const roomKey = device.room || "Other";
      if (!acc[roomKey]) acc[roomKey] = [];
      acc[roomKey].push(device);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-8">
      {Object.entries(groupedRooms).map(([roomName, roomDevices]) => (
        <section key={roomName} className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
            <h2 className="text-sm font-bold tracking-wider text-slate-600 uppercase flex items-center space-x-2">
              <Home className="w-4 h-4 text-teal-600" />
              <span>{roomName}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-sans">
                {roomDevices.length}
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {roomDevices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                onTogglePower={onTogglePower}
                onTestConnection={onTestConnection}
                onEditDevice={onEditDevice}
                onDeleteDevice={onDeleteDevice}
                isActionLoading={loadingDeviceIds.has(device.id)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

"use client";

import React from "react";
import { Device } from "@/types";
import { Lightbulb, Fan, Plug, Cpu, Plus, Activity, Pencil, Trash2 } from "lucide-react";
import { deviceAccent } from "@/lib/deviceTheme";
import { Group, Row } from "./Group";

const icons = { light: Lightbulb, fan: Fan, plug: Plug, other: Cpu };

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
  const iconBtn = "flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/[0.08]";

  return (
    <Group title={`${devices.length} ${devices.length === 1 ? "Device" : "Devices"}`}>
      {devices.map((device) => {
        const Icon = icons[device.type] ?? Cpu;
        const isConnected = device.connectionState === "connected";
        return (
          <div key={device.id} className="flex items-center gap-3 px-4 py-2.5">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]"
              style={{ backgroundColor: (deviceAccent[device.type] ?? deviceAccent.other).hex }}
            >
              <Icon className="h-[18px] w-[18px] text-[#151515]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px]">{device.name}</p>
              <p className="truncate text-[13px] text-muted">
                {device.room} · <span className="font-mono">{device.ip}</span>
                {!isConnected && <span className="text-danger"> · No Response</span>}
              </p>
            </div>
            <div className="flex shrink-0 items-center text-muted">
              <button onClick={() => onTestConnection(device.id)} className={iconBtn} aria-label="Test connection" title="Test connection">
                <Activity className="h-4 w-4" />
              </button>
              <button onClick={() => onEditDevice(device)} className={iconBtn} aria-label="Edit" title="Edit">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => onDeleteDevice(device)} className={`${iconBtn} text-danger`} aria-label="Delete" title="Delete">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
      <Row label={<span className="flex items-center gap-2 text-accent"><Plus className="h-4 w-4" />Add Device</span>} onClick={onOpenAddModal} />
    </Group>
  );
};

"use client";

import React, { useState } from "react";
import { Device, NetworkConfig } from "@/types";
import { GeneralSettings } from "./GeneralSettings";
import { NetworkSettings } from "./NetworkSettings";
import { DevicesSettings } from "./DevicesSettings";
import { ControllerSettings } from "./ControllerSettings";
import { AdvancedSettings } from "./AdvancedSettings";
import { Sliders, Wifi, Cpu, Server, Wrench } from "lucide-react";

interface SettingsViewProps {
  devices: Device[];
  networkConfig: NetworkConfig | null;
  currentUserRole?: "admin" | "user";
  onSaveNetworkConfig: (config: Partial<NetworkConfig>) => Promise<void>;
  onOpenAddModal: () => void;
  onEditDevice: (device: Device) => void;
  onDeleteDevice: (device: Device) => void;
  onTestConnection: (deviceId: string) => void;
  onResetDefaults: () => Promise<void>;
  onClearMockData: () => Promise<void>;
  showToast: (type: "success" | "error" | "info" | "warning", title: string, desc?: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  devices,
  networkConfig,
  currentUserRole = "admin",
  onSaveNetworkConfig,
  onOpenAddModal,
  onEditDevice,
  onDeleteDevice,
  onTestConnection,
  onResetDefaults,
  onClearMockData,
  showToast,
}) => {
  const [activeSection, setActiveSection] = useState<
    "general" | "network" | "devices" | "controller" | "advanced"
  >("network");

  const sections = [
    { id: "general", label: "General", icon: Sliders },
    { id: "network", label: "Network", icon: Wifi },
    { id: "devices", label: "Devices", icon: Cpu, badge: devices.length },
    { id: "controller", label: "Controller", icon: Server },
    { id: "advanced", label: "Advanced", icon: Wrench },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      <div>
        <h2 className="text-xl font-bold text-slate-900">Settings</h2>
        <p className="text-xs text-slate-500">
          Network options, ESP32 addresses, and gateway configuration
        </p>
      </div>

      <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pb-2 select-none">
        {sections.map((sec) => {
          const Icon = sec.icon;
          const isActive = activeSection === sec.id;
          return (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id as any)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${
                isActive
                  ? "bg-teal-600 text-white border-teal-600 shadow-xs"
                  : "bg-white hover:bg-slate-100 text-slate-600 border-slate-200"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{sec.label}</span>
              {sec.badge !== undefined && (
                <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                  isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}>
                  {sec.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {activeSection === "general" && <GeneralSettings currentUserRole={currentUserRole} />}

        {activeSection === "network" && (
          <NetworkSettings
            networkConfig={networkConfig}
            onSaveNetworkConfig={onSaveNetworkConfig}
            showToast={showToast}
          />
        )}

        {activeSection === "devices" && (
          <DevicesSettings
            devices={devices}
            onOpenAddModal={onOpenAddModal}
            onEditDevice={onEditDevice}
            onDeleteDevice={onDeleteDevice}
            onTestConnection={onTestConnection}
          />
        )}

        {activeSection === "controller" && (
          <ControllerSettings networkConfig={networkConfig} />
        )}

        {activeSection === "advanced" && (
          <AdvancedSettings
            networkConfig={networkConfig}
            devices={devices}
            onResetDefaults={onResetDefaults}
            onClearMockData={onClearMockData}
            showToast={showToast}
          />
        )}
      </div>

    </div>
  );
};

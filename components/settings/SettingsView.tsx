"use client";

import React, { useState } from "react";
import { Device, NetworkConfig } from "@/types";
import { GeneralSettings } from "./GeneralSettings";
import { NetworkSettings } from "./NetworkSettings";
import { DevicesSettings } from "./DevicesSettings";
import { ControllerSettings } from "./ControllerSettings";
import { AdvancedSettings } from "./AdvancedSettings";
import { AnimatePresence, motion } from "motion/react";
import { AccountSettings } from "./AccountSettings";
import { easeApple, springs } from "@/lib/deviceTheme";

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
  username: string;
  onSwitchAccount: () => void;
  onSignOut: () => void;
}

const sections = [
  { id: "account", label: "Account" },
  { id: "general", label: "General" },
  { id: "network", label: "Network" },
  { id: "devices", label: "Devices" },
  { id: "controller", label: "Controller" },
  { id: "advanced", label: "Advanced" },
] as const;

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
  username,
  onSwitchAccount,
  onSignOut,
}) => {
  const [activeSection, setActiveSection] = useState<(typeof sections)[number]["id"]>("account");

  return (
    <div className="max-w-2xl space-y-6">
      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max select-none rounded-[10px] bg-white/[0.06] p-0.5 text-[13px] font-medium sm:min-w-0">
          {sections.map((sec) => {
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className="relative flex-1 whitespace-nowrap rounded-[8px] px-3 py-1.5 text-ink"
              >
                {isActive && (
                  <motion.span
                    layoutId="settings-tab"
                    transition={springs.snappy}
                    className="absolute inset-0 rounded-[8px] bg-white/[0.16] shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
                  />
                )}
                <span className="relative">{sec.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: easeApple }}
        >
          {activeSection === "account" && (
            <AccountSettings
              username={username}
              role={currentUserRole}
              onSwitchAccount={onSwitchAccount}
              onSignOut={onSignOut}
            />
          )}

          {activeSection === "general" && <GeneralSettings currentUserRole={currentUserRole} />}

          {activeSection === "network" && (
            <NetworkSettings networkConfig={networkConfig} onSaveNetworkConfig={onSaveNetworkConfig} showToast={showToast} />
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

          {activeSection === "controller" && <ControllerSettings networkConfig={networkConfig} />}

          {activeSection === "advanced" && (
            <AdvancedSettings
              networkConfig={networkConfig}
              devices={devices}
              onResetDefaults={onResetDefaults}
              onClearMockData={onClearMockData}
              showToast={showToast}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

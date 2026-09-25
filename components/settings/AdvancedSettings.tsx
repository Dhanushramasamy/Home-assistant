"use client";

import React, { useState } from "react";
import { NetworkConfig, Device } from "@/types";
import { validateIpAgainstSubnet } from "@/lib/networkUtils";
import { Group, Row, rowInput } from "./Group";

interface AdvancedSettingsProps {
  networkConfig: NetworkConfig | null;
  devices: Device[];
  onResetDefaults: () => Promise<void>;
  onClearMockData: () => Promise<void>;
  showToast: (type: "success" | "error" | "info" | "warning", title: string, desc?: string) => void;
}

export const AdvancedSettings: React.FC<AdvancedSettingsProps> = ({
  networkConfig,
  devices,
  onResetDefaults,
  onClearMockData,
  showToast,
}) => {
  const [testIp, setTestIp] = useState("192.168.1.200");
  const [isProcessing, setIsProcessing] = useState(false);

  const subnet = networkConfig?.subnet || "192.168.1.0/24";
  const testValidation = validateIpAgainstSubnet(testIp, subnet);

  const handleReset = async () => {
    if (!window.confirm("Restore sample devices? This will replace your current device list.")) {
      return;
    }
    setIsProcessing(true);
    try {
      await onResetDefaults();
      showToast("success", "Sample Devices Restored", "Sample devices loaded into your dashboard.");
    } catch (err) {
      showToast("error", "Reset failed", (err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Clear all mock data? This will give you a clean slate to add your real devices.")) {
      return;
    }
    setIsProcessing(true);
    try {
      await onClearMockData();
      showToast("info", "Cleared Mock Data", "All sample devices removed. Ready to add your real devices!");
    } catch (err) {
      showToast("error", "Clear failed", (err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportJSON = () => {
    const backupData = {
      timestamp: new Date().toISOString(),
      network: networkConfig,
      devices,
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `home-control-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("success", "Exported JSON", "Configuration downloaded.");
  };

  return (
    <div className="space-y-8">
      <Group
        title={`Check IP against ${subnet}`}
        footer={
          <span className={testValidation.status === "success" ? "text-success" : "text-amber-300"}>
            {testValidation.message}
          </span>
        }
      >
        <Row label="IP Address">
          <input
            type="text"
            value={testIp}
            onChange={(e) => setTestIp(e.target.value)}
            placeholder="192.168.1.200"
            className={`${rowInput} font-mono`}
          />
        </Row>
      </Group>

      <Group title="Data">
        <Row label={<span className="text-accent">Export Configuration</span>} onClick={handleExportJSON} />
        <Row
          label={<span className={isProcessing ? "text-dim" : "text-accent"}>Load Sample Devices</span>}
          onClick={isProcessing ? undefined : handleReset}
        />
        <Row
          label={<span className={isProcessing || devices.length === 0 ? "text-dim" : "text-danger"}>Clear All Devices</span>}
          onClick={isProcessing || devices.length === 0 ? undefined : handleClearAll}
        />
      </Group>
    </div>
  );
};

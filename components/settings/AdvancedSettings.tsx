"use client";

import React, { useState } from "react";
import { NetworkConfig, Device } from "@/types";
import { validateIpAgainstSubnet } from "@/lib/networkUtils";
import {
  Wrench,
  RotateCcw,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileJson,
  Trash2,
  Sparkles,
} from "lucide-react";

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
    <div className="space-y-6">
      
      {/* Subnet Calculator Tool Card */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center space-x-3 border-b border-slate-100 pb-3">
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Subnet CIDR Verifier</h3>
            <p className="text-xs text-slate-500">Test IP address against active subnet ({subnet})</p>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <label className="block text-xs font-semibold text-slate-700">
            Test IP Address
          </label>
          <input
            type="text"
            value={testIp}
            onChange={(e) => setTestIp(e.target.value)}
            placeholder="e.g. 192.168.1.200"
            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-teal-500"
          />

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
            {testValidation.status === "success" && (
              <div className="text-emerald-700 font-bold flex items-center">
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                <span>{testValidation.message}</span>
              </div>
            )}
            {testValidation.status === "warning" && (
              <div className="text-amber-700 font-bold flex items-center">
                <AlertTriangle className="w-4 h-4 mr-1.5" />
                <span>{testValidation.message}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mock Data Management & Backup */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center space-x-3 border-b border-slate-100 pb-3">
          <div className="p-2.5 rounded-xl bg-teal-50 text-teal-600 border border-teal-200">
            <FileJson className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Data Management & Real Device Setup</h3>
            <p className="text-xs text-slate-500">Clear mock data or export backup files</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={handleClearAll}
            disabled={isProcessing || devices.length === 0}
            className="flex items-center justify-center space-x-1.5 p-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear All Mock Data</span>
          </button>

          <button
            onClick={handleReset}
            disabled={isProcessing}
            className="flex items-center justify-center space-x-1.5 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Load Sample Setup</span>
          </button>

          <button
            onClick={handleExportJSON}
            className="flex items-center justify-center space-x-1.5 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-teal-700 font-bold text-xs transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export Config JSON</span>
          </button>
        </div>
      </div>

    </div>
  );
};

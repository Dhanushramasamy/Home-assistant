"use client";

import React, { useState, useEffect } from "react";
import { NetworkConfig, DeviceMode } from "@/types";
import { Wifi, Server, Save } from "lucide-react";

interface NetworkSettingsProps {
  networkConfig: NetworkConfig | null;
  onSaveNetworkConfig: (config: Partial<NetworkConfig>) => Promise<void>;
  showToast: (type: "success" | "error" | "info" | "warning", title: string, desc?: string) => void;
}

export const NetworkSettings: React.FC<NetworkSettingsProps> = ({
  networkConfig,
  onSaveNetworkConfig,
  showToast,
}) => {
  const [name, setName] = useState("Home WiFi");
  const [subnet, setSubnet] = useState("192.168.1.0/24");
  const [gateway, setGateway] = useState("192.168.1.1");
  const [mode, setMode] = useState<DeviceMode>("direct");
  const [gatewayIp, setGatewayIp] = useState("192.168.1.100");
  const [gatewayPort, setGatewayPort] = useState(5000);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (networkConfig) {
      setName(networkConfig.name || "Home WiFi");
      setSubnet(networkConfig.subnet || "192.168.1.0/24");
      setGateway(networkConfig.gateway || "192.168.1.1");
      setMode(networkConfig.mode || "direct");
      setGatewayIp(networkConfig.gatewayIp || "192.168.1.100");
      setGatewayPort(networkConfig.gatewayPort || 5000);
    }
  }, [networkConfig]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveNetworkConfig({
        name,
        subnet,
        gateway,
        mode,
        gatewayIp,
        gatewayPort,
      });
      showToast(
        "success",
        "Network Updated",
        `Mode set to ${mode === "gateway" ? "Raspberry Pi Gateway" : "Direct ESP32"}`
      );
    } catch (err) {
      showToast("error", "Save failed", (err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSave} className="p-6 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-5">
        
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-sky-50 text-sky-700 border border-sky-200">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Network Configuration</h3>
              <p className="text-xs text-slate-500">Configure local network subnet and routing mode</p>
            </div>
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs active:scale-95 transition-all disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? "Saving..." : "Save Network"}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Network Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Subnet Mask (CIDR)
            </label>
            <input
              type="text"
              required
              value={subnet}
              onChange={(e) => setSubnet(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-teal-700 font-bold focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Gateway IP
            </label>
            <input
              type="text"
              required
              value={gateway}
              onChange={(e) => setGateway(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-teal-500"
            />
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <label className="block text-xs font-semibold text-slate-700">
            Communication Mode
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              onClick={() => setMode("direct")}
              className={`cursor-pointer p-3.5 rounded-xl border transition-all flex items-start space-x-3 ${
                mode === "direct"
                  ? "bg-sky-50/80 border-sky-400 text-sky-900"
                  : "bg-slate-50 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                mode === "direct" ? "border-sky-600 bg-sky-600" : "border-slate-400"
              }`}>
                {mode === "direct" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center">
                  <Wifi className="w-3.5 h-3.5 mr-1 text-sky-600" />
                  Direct ESP32 Mode
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Direct HTTP GET commands to device IPs (192.168.1.200/on)
                </p>
              </div>
            </div>

            <div
              onClick={() => setMode("gateway")}
              className={`cursor-pointer p-3.5 rounded-xl border transition-all flex items-start space-x-3 ${
                mode === "gateway"
                  ? "bg-purple-50/80 border-purple-400 text-purple-900"
                  : "bg-slate-50 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                mode === "gateway" ? "border-purple-600 bg-purple-600" : "border-slate-400"
              }`}>
                {mode === "gateway" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center">
                  <Server className="w-3.5 h-3.5 mr-1 text-purple-600" />
                  Raspberry Pi 5 Gateway Mode
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Central Pi 5 router resolves device IDs and routes traffic
                </p>
              </div>
            </div>
          </div>
        </div>

        {mode === "gateway" && (
          <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-200 space-y-3">
            <div className="flex items-center justify-between border-b border-purple-100 pb-2">
              <span className="text-xs font-bold text-purple-900 flex items-center">
                <Server className="w-3.5 h-3.5 mr-1.5 text-purple-700" />
                Raspberry Pi 5 Parameters
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                ● Connected
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Raspberry Pi IP
                </label>
                <input
                  type="text"
                  required
                  value={gatewayIp}
                  onChange={(e) => setGatewayIp(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-purple-800 font-bold focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pi Port
                </label>
                <input
                  type="number"
                  required
                  value={gatewayPort}
                  onChange={(e) => setGatewayPort(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-purple-800 font-bold focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          </div>
        )}

      </form>
    </div>
  );
};

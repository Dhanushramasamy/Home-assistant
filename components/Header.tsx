"use client";

import React from "react";
import { NetworkConfig } from "@/types";
import { Home, Settings, Wifi, Server, Cpu, Plus, Trash2 } from "lucide-react";

interface HeaderProps {
  activeTab: "dashboard" | "settings";
  onTabChange: (tab: "dashboard" | "settings") => void;
  networkConfig: NetworkConfig | null;
  onOpenAddModal: () => void;
  onClearMockData: () => void;
  hasDevices: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  networkConfig,
  onOpenAddModal,
  onClearMockData,
  hasDevices,
}) => {
  const isGateway = networkConfig?.mode === "gateway";

  return (
    <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          
          {/* Brand Title & Subtitle */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-teal-100 text-teal-700 font-bold text-lg border border-teal-200">
              <Cpu className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Home Control
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  ● Connected
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Simple smart-home controller
              </p>
            </div>
          </div>

          {/* Mode Badge */}
          <div className="hidden lg:flex items-center space-x-2 bg-slate-100/80 px-3 py-1.5 rounded-full border border-slate-200 text-xs text-slate-600">
            {isGateway ? (
              <>
                <Server className="w-3.5 h-3.5 text-purple-600" />
                <span className="font-medium text-slate-700">Mode:</span>
                <span className="text-purple-700 font-semibold">
                  Pi 5 Gateway ({networkConfig?.gatewayIp || "192.168.1.100"})
                </span>
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5 text-sky-600" />
                <span className="font-medium text-slate-700">Mode:</span>
                <span className="text-sky-700 font-semibold">Direct ESP32 Control</span>
              </>
            )}
          </div>

          {/* Navigation & Actions */}
          <div className="flex items-center space-x-2">
            
            {hasDevices && (
              <button
                onClick={onClearMockData}
                className="hidden sm:flex items-center space-x-1 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-medium transition-colors"
                title="Clear mock data to add your real devices"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Mock Data</span>
              </button>
            )}

            <button
              onClick={onOpenAddModal}
              className="flex items-center space-x-1 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs sm:text-sm shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Device</span>
            </button>

            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                onClick={() => onTabChange("dashboard")}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  activeTab === "dashboard"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Home className="w-4 h-4" />
                <span>Home</span>
              </button>

              <button
                onClick={() => onTabChange("settings")}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  activeTab === "settings"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </header>
  );
};

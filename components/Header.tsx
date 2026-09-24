"use client";

import React, { useState } from "react";
import { NetworkConfig } from "@/types";
import { Home, Settings, Wifi, Server, Cpu, Plus, Trash2, Menu, X } from "lucide-react";

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isGateway = networkConfig?.mode === "gateway";

  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          
          {/* Brand Title & Subtitle */}
          <div className="flex items-center space-x-2.5">
            <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-teal-100 text-teal-700 font-bold text-base sm:text-lg border border-teal-200 shrink-0">
              <Cpu className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center space-x-1.5">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  Home Control
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                  ● Connected
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Simple smart-home controller
              </p>
            </div>
          </div>

          {/* Desktop Center Mode Badge */}
          <div className="hidden md:flex items-center space-x-2 bg-slate-100/90 px-3 py-1.5 rounded-full border border-slate-200 text-xs text-slate-600">
            {isGateway ? (
              <>
                <Server className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span className="font-medium text-slate-700">Mode:</span>
                <span className="text-purple-700 font-semibold truncate max-w-[200px]">
                  Pi 5 Gateway ({networkConfig?.gatewayIp || "192.168.1.100"})
                </span>
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span className="font-medium text-slate-700">Mode:</span>
                <span className="text-sky-700 font-semibold">Direct ESP32 Control</span>
              </>
            )}
          </div>

          {/* Desktop Navigation & Actions */}
          <div className="hidden sm:flex items-center space-x-2">
            {hasDevices && (
              <button
                onClick={onClearMockData}
                className="flex items-center space-x-1 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-medium transition-colors"
                title="Clear mock data to add real devices"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Mock</span>
              </button>
            )}

            <button
              onClick={onOpenAddModal}
              className="flex items-center space-x-1 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs sm:text-sm shadow-2xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Device</span>
            </button>

            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                onClick={() => onTabChange("dashboard")}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  activeTab === "dashboard"
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
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
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </button>
            </div>
          </div>

          {/* Mobile Right Bar: Quick Add + Hamburger Toggle */}
          <div className="flex sm:hidden items-center space-x-2">
            <button
              onClick={onOpenAddModal}
              className="p-2 rounded-xl bg-teal-600 text-white shadow-2xs shrink-0"
              aria-label="Add Device"
            >
              <Plus className="w-4 h-4" />
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 shrink-0"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-3 shadow-md animate-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                onTabChange("dashboard");
                setMobileMenuOpen(false);
              }}
              className={`flex items-center justify-center space-x-2 py-2.5 rounded-xl text-xs font-semibold border ${
                activeTab === "dashboard"
                  ? "bg-teal-600 text-white border-teal-600"
                  : "bg-slate-50 text-slate-700 border-slate-200"
              }`}
            >
              <Home className="w-4 h-4" />
              <span>Home Dashboard</span>
            </button>

            <button
              onClick={() => {
                onTabChange("settings");
                setMobileMenuOpen(false);
              }}
              className={`flex items-center justify-center space-x-2 py-2.5 rounded-xl text-xs font-semibold border ${
                activeTab === "settings"
                  ? "bg-teal-600 text-white border-teal-600"
                  : "bg-slate-50 text-slate-700 border-slate-200"
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-500 font-medium">Network Mode:</span>
            <span className="font-semibold text-teal-700">
              {isGateway ? "Pi 5 Gateway" : "Direct ESP32"}
            </span>
          </div>

          {hasDevices && (
            <button
              onClick={() => {
                onClearMockData();
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center justify-center space-x-1.5 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Mock Data</span>
            </button>
          )}
        </div>
      )}
    </header>
  );
};

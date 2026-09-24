"use client";

import React from "react";
import { Device, NetworkConfig } from "@/types";
import { Cpu, Power, PowerOff, Wifi, Server } from "lucide-react";

interface SummaryCardsProps {
  devices: Device[];
  networkConfig: NetworkConfig | null;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  devices,
  networkConfig,
}) => {
  const totalCount = devices.length;
  const onCount = devices.filter((d) => d.powerState === "on").length;
  const offCount = devices.filter((d) => d.powerState === "off").length;
  const isGateway = networkConfig?.mode === "gateway";

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-4 sm:mb-6">
      
      {/* Card 1: Total Devices */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase">
              Total Devices
            </p>
            <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-0.5">
              {totalCount} <span className="text-[10px] sm:text-xs font-medium text-slate-400">devices</span>
            </h3>
          </div>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-200 shrink-0">
            <Cpu className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Card 2: Devices ON */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 shadow-2xs">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] sm:text-xs font-semibold text-emerald-800 uppercase">
              Active ON
            </p>
            <h3 className="text-xl sm:text-2xl font-extrabold text-emerald-700 mt-0.5">
              {onCount} <span className="text-[10px] sm:text-xs font-medium text-emerald-600">active</span>
            </h3>
          </div>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-300 shrink-0">
            <Power className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Card 3: Devices OFF */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase">
              Inactive OFF
            </p>
            <h3 className="text-xl sm:text-2xl font-extrabold text-slate-700 mt-0.5">
              {offCount} <span className="text-[10px] sm:text-xs font-medium text-slate-400">off</span>
            </h3>
          </div>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center border border-slate-200 shrink-0">
            <PowerOff className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Card 4: Network Mode */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs col-span-2 lg:col-span-1">
        <div className="flex items-center justify-between">
          <div className="min-w-0 pr-1">
            <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase">
              System Routing
            </p>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5 truncate">
              {isGateway ? "Pi 5 Gateway" : "Direct ESP32"}
            </h3>
            <p className="text-[10px] sm:text-[11px] text-slate-500 truncate">
              {isGateway ? `IP: ${networkConfig?.gatewayIp || "192.168.1.100"}` : `Subnet: ${networkConfig?.subnet || "192.168.1.0/24"}`}
            </p>
          </div>
          <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center border shrink-0 ${
            isGateway
              ? "bg-purple-50 text-purple-600 border-purple-200"
              : "bg-teal-50 text-teal-600 border-teal-200"
          }`}>
            {isGateway ? <Server className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
          </div>
        </div>
      </div>

    </div>
  );
};

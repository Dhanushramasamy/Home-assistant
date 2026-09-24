"use client";

import React, { useState, useEffect } from "react";
import { Server, Cpu, RefreshCw, CheckCircle2 } from "lucide-react";
import { NetworkConfig } from "@/types";

interface ControllerSettingsProps {
  networkConfig: NetworkConfig | null;
}

export const ControllerSettings: React.FC<ControllerSettingsProps> = ({
  networkConfig,
}) => {
  const [loading, setLoading] = useState(false);

  return (
    <div className="space-y-4">
      
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 border border-purple-200">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Raspberry Pi 5 Gateway & Router</h3>
              <p className="text-xs text-slate-500">Gateway routing engine parameters</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="text-[11px] text-slate-500 uppercase font-bold">Gateway Host</div>
            <div className="text-sm font-mono text-purple-800 font-extrabold">
              {networkConfig?.gatewayIp || "192.168.1.100"}:{networkConfig?.gatewayPort || 5000}
            </div>
            <div className="text-[11px] text-emerald-700 flex items-center pt-1 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mr-1" />
              Status: ● Online & Ready
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="text-[11px] text-slate-500 uppercase font-bold">Engine</div>
            <div className="text-sm font-bold text-slate-900">
              Raspberry Pi 5 Central Router
            </div>
            <div className="text-[11px] text-sky-700 flex items-center pt-1 font-semibold">
              <Cpu className="w-3.5 h-3.5 text-sky-600 mr-1" />
              Mode: {networkConfig?.mode === "gateway" ? "Pi 5 Gateway Active" : "Direct Pass-through"}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

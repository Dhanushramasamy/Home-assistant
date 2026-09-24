"use client";

import React from "react";
import { TestConnectionResponse } from "@/types";
import {
  X,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Wifi,
  Server,
  Terminal,
} from "lucide-react";

interface ConnectionTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: TestConnectionResponse | null;
  isLoading: boolean;
  deviceName?: string;
}

export const ConnectionTestModal: React.FC<ConnectionTestModalProps> = ({
  isOpen,
  onClose,
  result,
  isLoading,
  deviceName = "Device",
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-cyan-400 animate-pulse" />
            <h3 className="text-base font-extrabold text-white">Connection Diagnostic</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-cyan-500/10 text-cyan-400">
                <Activity className="w-8 h-8 animate-spin" />
              </div>
              <p className="text-sm font-semibold text-slate-200">
                Testing connection to {deviceName}...
              </p>
              <p className="text-xs text-slate-400">Sending HTTP probe ping...</p>
            </div>
          ) : result ? (
            <div className="space-y-4">
              
              {/* Main Banner */}
              <div
                className={`p-4 rounded-2xl border flex items-start space-x-3 ${
                  result.reachable
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                }`}
              >
                <div className="shrink-0 mt-0.5">
                  {result.reachable ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  ) : (
                    <XCircle className="w-6 h-6 text-rose-400" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold tracking-wide">
                    {result.message}
                  </h4>
                  {result.details && (
                    <p className="text-xs mt-1 text-slate-300 leading-relaxed">
                      {result.details}
                    </p>
                  )}
                </div>
              </div>

              {/* Technical Trace Details */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="flex items-center">
                    <Terminal className="w-3.5 h-3.5 mr-1 text-slate-500" />
                    Target IP
                  </span>
                  <span className="font-mono text-white font-bold">{result.ip}</span>
                </div>

                <div className="flex items-center justify-between text-slate-400">
                  <span className="flex items-center">
                    {result.mode === "gateway" ? (
                      <Server className="w-3.5 h-3.5 mr-1 text-violet-400" />
                    ) : (
                      <Wifi className="w-3.5 h-3.5 mr-1 text-cyan-400" />
                    )}
                    Communication Mode
                  </span>
                  <span className="font-semibold text-slate-200 uppercase">
                    {result.mode === "gateway" ? "Pi 5 Gateway" : "Direct ESP32"}
                  </span>
                </div>

                {result.responseTimeMs !== undefined && (
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="flex items-center">
                      <Clock className="w-3.5 h-3.5 mr-1 text-slate-500" />
                      Response Time
                    </span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {result.responseTimeMs} ms
                    </span>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-900">
                  <span className="block text-[10px] text-slate-500 font-bold uppercase mb-1">
                    Probe Target URL
                  </span>
                  <span className="block font-mono text-[11px] text-slate-300 bg-slate-900 p-2 rounded-xl truncate">
                    {result.targetUrl}
                  </span>
                </div>
              </div>

            </div>
          ) : null}

          {/* Close button */}
          <div className="pt-2 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-colors"
            >
              Close Diagnostic
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

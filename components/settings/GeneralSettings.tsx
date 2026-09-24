"use client";

import React from "react";
import { Sliders, ShieldCheck } from "lucide-react";

export const GeneralSettings: React.FC = () => {
  return (
    <div className="space-y-4">
      
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center space-x-3 border-b border-slate-100 pb-3">
          <div className="p-2.5 rounded-xl bg-teal-50 text-teal-600 border border-teal-200">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">General Options</h3>
            <p className="text-xs text-slate-500">Preferences and security parameters</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <h4 className="text-xs font-bold text-slate-800">Theme Atmosphere</h4>
              <p className="text-[11px] text-slate-500">Minimalist Pastel Light Mode</p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-teal-100 text-teal-800 font-bold text-xs border border-teal-200">
              Soft Pastel
            </span>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <h4 className="text-xs font-bold text-slate-800">Security Isolation</h4>
              <p className="text-[11px] text-slate-500">Registered Device IDs strictly resolved by server</p>
            </div>
            <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Active</span>
            </span>
          </div>
        </div>
      </div>

    </div>
  );
};

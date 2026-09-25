"use client";

import dynamic from "next/dynamic";
import React from "react";
import { Lightbulb, Fan, Plug } from "lucide-react";

const LampCanvas = dynamic(
  () => import("./LampCanvas").then((m) => m.LampCanvas),
  { ssr: false, loading: () => <Loading3DFallback type="light" /> }
);

const FanCanvas = dynamic(
  () => import("./FanCanvas").then((m) => m.FanCanvas),
  { ssr: false, loading: () => <Loading3DFallback type="fan" /> }
);

function Loading3DFallback({ type }: { type: string }) {
  return (
    <div className="w-full h-64 sm:h-72 rounded-2xl flex flex-col items-center justify-center space-y-2 animate-pulse">
      {type === "light" ? (
        <Lightbulb className="w-8 h-8 text-amber-500/40 animate-pulse" />
      ) : (
        <Fan className="w-8 h-8 text-sky-500/40 animate-spin" />
      )}
      <span className="text-[10px] text-dim font-semibold uppercase tracking-wider">Rendering 3D Model...</span>
    </div>
  );
}

interface Dynamic3DCanvasProps {
  type: "light" | "fan" | "plug" | "other";
  isOn: boolean;
  value?: number; // Brightness 0-100 or Speed 1-5
}

export const Dynamic3DCanvas: React.FC<Dynamic3DCanvasProps> = ({
  type,
  isOn,
  value = 80,
}) => {
  if (type === "light") {
    return <LampCanvas isOn={isOn} brightness={value} />;
  }

  if (type === "fan") {
    return <FanCanvas isOn={isOn} speed={value > 10 ? Math.round((value / 100) * 4) + 1 : value} />;
  }

  // Fallback for Plug / Other
  return (
    <div className="w-full h-56 sm:h-64 rounded-2xl bg-gradient-to-b from-white/[0.03] to-black/40 border border-line flex flex-col items-center justify-center space-y-2">
      <div className={`p-4 rounded-2xl border transition-all ${isOn ? "bg-tint-plug/15 border-tint-plug/60 text-tint-plug shadow-[0_0_40px_-6px_rgba(94,234,212,0.6)]" : "bg-white/[0.06] border-line text-dim"}`}>
        <Plug className="w-10 h-10" />
      </div>
      <span className="text-xs font-bold text-muted uppercase tracking-wider">
        {isOn ? "Active Relay ON" : "Relay OFF"}
      </span>
    </div>
  );
};

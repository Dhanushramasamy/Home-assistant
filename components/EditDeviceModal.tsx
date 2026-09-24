"use client";

import React, { useState, useEffect } from "react";
import { Device, DeviceType, DeviceMode, NetworkConfig } from "@/types";
import {
  parseIPv4Octets,
  octetsToIPv4,
  validateIpAgainstSubnet,
} from "@/lib/networkUtils";
import { X, Lightbulb, Fan, Plug, Cpu, CheckCircle2, AlertTriangle } from "lucide-react";

interface EditDeviceModalProps {
  isOpen: boolean;
  device: Device | null;
  onClose: () => void;
  onSave: (
    id: string,
    updates: Partial<Device>
  ) => Promise<void>;
  networkConfig: NetworkConfig | null;
  existingRooms: string[];
}

export const EditDeviceModal: React.FC<EditDeviceModalProps> = ({
  isOpen,
  device,
  onClose,
  onSave,
  networkConfig,
  existingRooms,
}) => {
  const [name, setName] = useState("");
  const [room, setRoom] = useState("Bedroom");
  const [type, setType] = useState<DeviceType>("light");
  const [mode, setMode] = useState<DeviceMode>("direct");
  const [octets, setOctets] = useState<[string, string, string, string]>([
    "192",
    "168",
    "1",
    "200",
  ]);
  const [relay, setRelay] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (device && isOpen) {
      setName(device.name);
      setRoom(device.room);
      setType(device.type);
      setMode(device.mode);
      setOctets(parseIPv4Octets(device.ip));
      setRelay(device.relay || 1);
    }
  }, [device, isOpen]);

  if (!isOpen || !device) return null;

  const currentIp = octetsToIPv4(octets);
  const subnet = networkConfig?.subnet || "192.168.1.0/24";
  const validation = validateIpAgainstSubnet(currentIp, subnet);

  const handleOctetChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 3);
    const newOctets = [...octets] as [string, string, string, string];
    newOctets[index] = cleaned;
    setOctets(newOctets);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onSave(device.id, {
        name: name.trim(),
        room,
        type,
        mode,
        ip: currentIp,
        relay,
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-950/50">
          <div>
            <h3 className="text-lg font-black text-white">Edit Device Configuration</h3>
            <p className="text-xs text-slate-400">Modify device parameters and IP address</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Device Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Room
              </label>
              <input
                type="text"
                required
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Relay Number
              </label>
              <select
                value={relay}
                onChange={(e) => setRelay(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500"
              >
                <option value={1}>Relay 1</option>
                <option value={2}>Relay 2</option>
                <option value={3}>Relay 3</option>
                <option value={4}>Relay 4</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Device Type
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: "light", label: "Light", icon: Lightbulb },
                { id: "fan", label: "Fan", icon: Fan },
                { id: "plug", label: "Plug", icon: Plug },
                { id: "other", label: "Other", icon: Cpu },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = type === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setType(item.id as DeviceType)}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${
                      isSelected
                        ? "bg-cyan-500/15 border-cyan-500 text-cyan-400 font-bold"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    <Icon className="w-5 h-5 mb-1" />
                    <span className="text-xs">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Communication Mode
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode("direct")}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  mode === "direct"
                    ? "bg-cyan-500/15 border-cyan-500 text-cyan-300 font-semibold"
                    : "bg-slate-950 border-slate-800 text-slate-400"
                }`}
              >
                <div className="text-xs font-bold text-white">Direct ESP32</div>
                <div className="text-[11px] text-slate-400">Direct HTTP GET</div>
              </button>

              <button
                type="button"
                onClick={() => setMode("gateway")}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  mode === "gateway"
                    ? "bg-violet-500/15 border-violet-500 text-violet-300 font-semibold"
                    : "bg-slate-950 border-slate-800 text-slate-400"
                }`}
              >
                <div className="text-xs font-bold text-white">Raspberry Pi Gateway</div>
                <div className="text-[11px] text-slate-400">Pi 5 Router engine</div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              ESP32 Local Address
            </label>

            <div className="flex items-center space-x-2 bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
              <input
                type="text"
                value={octets[0]}
                onChange={(e) => handleOctetChange(0, e.target.value)}
                className="w-14 text-center py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-sm font-mono text-cyan-400 font-bold focus:outline-none focus:border-cyan-500"
              />
              <span className="text-slate-600 font-bold">.</span>
              <input
                type="text"
                value={octets[1]}
                onChange={(e) => handleOctetChange(1, e.target.value)}
                className="w-14 text-center py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-sm font-mono text-cyan-400 font-bold focus:outline-none focus:border-cyan-500"
              />
              <span className="text-slate-600 font-bold">.</span>
              <input
                type="text"
                value={octets[2]}
                onChange={(e) => handleOctetChange(2, e.target.value)}
                className="w-14 text-center py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-sm font-mono text-cyan-400 font-bold focus:outline-none focus:border-cyan-500"
              />
              <span className="text-slate-600 font-bold">.</span>
              <input
                type="text"
                value={octets[3]}
                onChange={(e) => handleOctetChange(3, e.target.value)}
                className="w-14 text-center py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-sm font-mono text-cyan-400 font-bold focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="mt-2 space-y-1">
              <p className="text-[11px] text-slate-400">
                This is the local IP address assigned to this ESP32.
              </p>
              {validation.status === "success" && (
                <p className="text-xs text-emerald-400 font-medium flex items-center">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  {validation.message}
                </p>
              )}
              {validation.status === "warning" && (
                <p className="text-xs text-amber-400 font-medium flex items-center">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                  {validation.message}
                </p>
              )}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/20 active:scale-95 transition-all disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Update Device"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

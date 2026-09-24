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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden text-slate-800">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">Edit Device</h3>
            <p className="text-xs text-slate-500">Modify device parameters and IP address</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Device Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Room
              </label>
              <input
                type="text"
                required
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Relay Number
              </label>
              <select
                value={relay}
                onChange={(e) => setRelay(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-teal-500"
              >
                <option value={1}>Relay 1</option>
                <option value={2}>Relay 2</option>
                <option value={3}>Relay 3</option>
                <option value={4}>Relay 4</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
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
                    className={`flex flex-col items-center justify-center p-2 sm:p-2.5 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-teal-50 border-teal-500 text-teal-700 font-bold"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className="w-4 h-4 mb-1" />
                    <span className="text-[11px] sm:text-xs">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Communication Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("direct")}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  mode === "direct"
                    ? "bg-sky-50 border-sky-400 text-sky-800 font-semibold"
                    : "bg-slate-50 border-slate-200 text-slate-600"
                }`}
              >
                <div className="text-xs font-bold">Direct ESP32</div>
                <div className="text-[10px] sm:text-[11px] text-slate-500">Direct HTTP</div>
              </button>

              <button
                type="button"
                onClick={() => setMode("gateway")}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  mode === "gateway"
                    ? "bg-purple-50 border-purple-400 text-purple-800 font-semibold"
                    : "bg-slate-50 border-slate-200 text-slate-600"
                }`}
              >
                <div className="text-xs font-bold">Pi Gateway</div>
                <div className="text-[10px] sm:text-[11px] text-slate-500">Central Pi 5</div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ESP32 Local IP
            </label>

            <div className="flex items-center justify-between space-x-1 sm:space-x-1.5 bg-slate-50 p-2 rounded-xl border border-slate-200">
              <input
                type="text"
                value={octets[0]}
                onChange={(e) => handleOctetChange(0, e.target.value)}
                className="w-full text-center py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono text-teal-700 font-bold focus:outline-none focus:border-teal-500"
              />
              <span className="text-slate-400 font-bold">.</span>
              <input
                type="text"
                value={octets[1]}
                onChange={(e) => handleOctetChange(1, e.target.value)}
                className="w-full text-center py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono text-teal-700 font-bold focus:outline-none focus:border-teal-500"
              />
              <span className="text-slate-400 font-bold">.</span>
              <input
                type="text"
                value={octets[2]}
                onChange={(e) => handleOctetChange(2, e.target.value)}
                className="w-full text-center py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono text-teal-700 font-bold focus:outline-none focus:border-teal-500"
              />
              <span className="text-slate-400 font-bold">.</span>
              <input
                type="text"
                value={octets[3]}
                onChange={(e) => handleOctetChange(3, e.target.value)}
                className="w-full text-center py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono text-teal-700 font-bold focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="mt-1.5">
              {validation.status === "success" && (
                <p className="text-[11px] sm:text-xs text-emerald-700 font-medium flex items-center">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 shrink-0" />
                  {validation.message}
                </p>
              )}
              {validation.status === "warning" && (
                <p className="text-[11px] sm:text-xs text-amber-700 font-medium flex items-center">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1 shrink-0" />
                  {validation.message}
                </p>
              )}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-2xs active:scale-95 transition-all disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Update Device"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

"use client";

import React, { useState, useEffect } from "react";
import { DeviceType, DeviceMode, NetworkConfig } from "@/types";
import { octetsToIPv4, validateIpAgainstSubnet } from "@/lib/networkUtils";
import { ModalShell } from "@/components/ui/ModalShell";
import { SheetHeader, FormGroup, FormRow, TypePicker, ModeSegment, IpInput, rowInput, rowSelect } from "./DeviceFormParts";

interface AddDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (deviceData: {
    name: string;
    room: string;
    type: DeviceType;
    mode: DeviceMode;
    ip: string;
    relay: number;
  }) => Promise<void>;
  networkConfig: NetworkConfig | null;
  existingRooms: string[];
}

export const AddDeviceModal: React.FC<AddDeviceModalProps> = ({
  isOpen,
  onClose,
  onSave,
  networkConfig,
  existingRooms,
}) => {
  const [name, setName] = useState("");
  const [room, setRoom] = useState("Bedroom");
  const [customRoom, setCustomRoom] = useState("");
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
    if (isOpen) {
      setName("");
      setType("light");
      setMode(networkConfig?.mode || "direct");
      setOctets(["192", "168", "1", "200"]);
      setRelay(1);
    }
  }, [isOpen, networkConfig]);

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

    const finalRoom = room === "Custom" ? customRoom.trim() || "General" : room;
    setIsSubmitting(true);

    try {
      await onSave({
        name: name.trim(),
        room: finalRoom,
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
    <ModalShell isOpen={isOpen} onClose={onClose} className="max-w-lg">
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
        <SheetHeader
          title="Add Device"
          confirmLabel={isSubmitting ? "Saving…" : "Add"}
          canConfirm={!isSubmitting && !!name.trim()}
          onCancel={onClose}
        />

        <div className="space-y-6 overflow-y-auto bg-canvas px-4 py-6">
          <FormGroup>
            <FormRow label="Name">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Bedroom Light"
                className={rowInput}
              />
            </FormRow>
            <FormRow label="Room">
              <select value={room} onChange={(e) => setRoom(e.target.value)} className={rowSelect}>
                {Array.from(new Set(["Bedroom", "Hall", "Kitchen", "Living Room", ...existingRooms])).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
                <option value="Custom">New Room…</option>
              </select>
            </FormRow>
            {room === "Custom" && (
              <FormRow label="Room Name">
                <input
                  type="text"
                  required
                  value={customRoom}
                  onChange={(e) => setCustomRoom(e.target.value)}
                  placeholder="Balcony"
                  className={rowInput}
                />
              </FormRow>
            )}
              <FormRow label="Relay">
                <select value={relay} onChange={(e) => setRelay(Number(e.target.value))} className={rowSelect}>
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </FormRow>
          </FormGroup>

          <FormGroup caption="Type">
            <TypePicker value={type} onChange={setType} />
          </FormGroup>

          <FormGroup
            caption="Connection"
            footer={validation.status === "warning" ? (
                <span className="text-tint-light">{validation.message}</span>
              ) : null}
          >
            <ModeSegment value={mode} onChange={setMode} layoutId="add-mode-seg" />
            <FormRow label="IP Address">
              <IpInput octets={octets} onChange={handleOctetChange} />
            </FormRow>
          </FormGroup>
        </div>
      </form>
    </ModalShell>
  );
};

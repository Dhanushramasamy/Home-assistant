"use client";

import React, { useState, useEffect } from "react";
import { Device, DeviceType, DeviceMode, NetworkConfig } from "@/types";
import {
  parseIPv4Octets,
  octetsToIPv4,
  validateIpAgainstSubnet,
} from "@/lib/networkUtils";
import { ModalShell } from "@/components/ui/ModalShell";
import { SheetHeader, FormGroup, FormRow, TypePicker, ModeSegment, IpInput, rowInput, rowSelect } from "./DeviceFormParts";

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
    if (!device || !name.trim()) return;

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
    <ModalShell isOpen={isOpen && !!device} onClose={onClose} className="max-w-lg">
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
        <SheetHeader
          title="Edit Device"
          confirmLabel={isSubmitting ? "Saving…" : "Save"}
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
              <input type="text" required value={room} onChange={(e) => setRoom(e.target.value)} className={rowInput} />
            </FormRow>
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
            <ModeSegment value={mode} onChange={setMode} layoutId="edit-mode-seg" />
            <FormRow label="IP Address">
              <IpInput octets={octets} onChange={handleOctetChange} />
            </FormRow>
          </FormGroup>
        </div>
      </form>
    </ModalShell>
  );
};

"use client";

import React, { useState, useEffect } from "react";
import { CloudBoard, DEFAULT_SERVO_OFF_ANGLE, DEFAULT_SERVO_ON_ANGLE, DEFAULT_SERVO_SPEED_DPS, Device, DeviceType, NetworkConfig } from "@/types";
import {
  parseIPv4Octets,
  octetsToIPv4,
  validateIpAgainstSubnet,
} from "@/lib/networkUtils";
import { ModalShell } from "@/components/ui/ModalShell";
import { SheetHeader, FormGroup, FormRow, TypePicker, IpInput, BoardField, cleanBoardId, rowInput, rowSelect } from "./DeviceFormParts";

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
  const [octets, setOctets] = useState<[string, string, string, string]>([
    "192",
    "168",
    "1",
    "200",
  ]);
  const [relay, setRelay] = useState(1);
  const [boardId, setBoardId] = useState("");
  const [servoOnAngle, setServoOnAngle] = useState(DEFAULT_SERVO_ON_ANGLE);
  const [servoOffAngle, setServoOffAngle] = useState(DEFAULT_SERVO_OFF_ANGLE);
  const [servoSpeedDps, setServoSpeedDps] = useState(DEFAULT_SERVO_SPEED_DPS);
  const [boards, setBoards] = useState<CloudBoard[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (device && isOpen) {
      setName(device.name);
      setRoom(device.room);
      setType(device.type);
      setOctets(parseIPv4Octets(device.ip));
      setRelay(device.relay || 1);
      setBoardId(device.boardId ?? "");
      setServoOnAngle(device.servoOnAngle ?? DEFAULT_SERVO_ON_ANGLE);
      setServoOffAngle(device.servoOffAngle ?? DEFAULT_SERVO_OFF_ANGLE);
      setServoSpeedDps(device.servoSpeedDps ?? DEFAULT_SERVO_SPEED_DPS);
    }
  }, [device, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setBoardsLoading(true);
    fetch("/api/boards", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Could not load boards."))))
      .then((data: { boards?: CloudBoard[] }) => {
        if (active) setBoards(data.boards ?? []);
      })
      .catch(() => {
        if (active) setBoards([]);
      })
      .finally(() => {
        if (active) setBoardsLoading(false);
      });
    return () => { active = false; };
  }, [isOpen]);

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
    if (!device || !name.trim() || (type === "servo" && !cleanBoardId(boardId))) return;

    setIsSubmitting(true);
    try {
      await onSave(device.id, {
        name: name.trim(),
        room,
        type,
        mode: "direct",
        ip: cleanBoardId(boardId) ? "" : currentIp,
        relay,
        boardId: cleanBoardId(boardId),
        ...(type === "servo" ? { servoOnAngle, servoOffAngle, servoSpeedDps } : {}),
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
          canConfirm={!isSubmitting && !!name.trim() && (type !== "servo" || !!cleanBoardId(boardId))}
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
              {type !== "servo" && <FormRow label="Relay">
                <select value={relay} onChange={(e) => setRelay(Number(e.target.value))} className={rowSelect}>
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </FormRow>}
          </FormGroup>

          <FormGroup caption="Type">
            <TypePicker value={type} onChange={(nextType) => {
              setType(nextType);
              if (nextType === "servo" && !boards.some((board) => board.boardId === boardId && board.servoPin !== null)) setBoardId("");
            }} />
          </FormGroup>

          <BoardField value={boardId} onChange={setBoardId} boards={boards} loading={boardsLoading} servoOnly={type === "servo"} />
          {type === "servo" && <>
            <FormGroup caption="Servo switch">
              <FormRow label="ON angle (°)"><input type="number" step={1} required placeholder="90" value={servoOnAngle} onChange={(e) => setServoOnAngle(Number(e.target.value))} className={rowInput} /></FormRow>
              <FormRow label="OFF angle (°)"><input type="number" step={1} required placeholder="180" value={servoOffAngle} onChange={(e) => setServoOffAngle(Number(e.target.value))} className={rowInput} /></FormRow>
              <FormRow label="Movement speed (°/sec)"><input type="number" step={1} required placeholder="20" value={servoSpeedDps} onChange={(e) => setServoSpeedDps(Number(e.target.value))} className={rowInput} /></FormRow>
            </FormGroup>
            <p className="-mt-4 px-4 text-[11px] text-muted">Use different ON/OFF angles. Board accepts 0–180° angles and speed 1–180°/sec.</p>
          </>}

          {/* A cloud board gets its address from the Wi-Fi; the IP is only for boards without one. */}
          {type !== "servo" && !cleanBoardId(boardId) && (
            <FormGroup
              caption="Direct (same Wi-Fi)"
              footer={validation.status === "warning" ? (
                  <span className="text-tint-light">{validation.message}</span>
                ) : null}
            >
              <FormRow label="IP Address">
                <IpInput octets={octets} onChange={handleOctetChange} />
              </FormRow>
            </FormGroup>
          )}
        </div>
      </form>
    </ModalShell>
  );
};

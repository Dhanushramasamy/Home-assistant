"use client";

import React, { useState, useEffect } from "react";
import { NetworkConfig, DeviceMode } from "@/types";
import { Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { easeApple } from "@/lib/deviceTheme";
import { Group, Row, rowInput } from "./Group";

interface NetworkSettingsProps {
  networkConfig: NetworkConfig | null;
  onSaveNetworkConfig: (config: Partial<NetworkConfig>) => Promise<void>;
  showToast: (type: "success" | "error" | "info" | "warning", title: string, desc?: string) => void;
}

export const NetworkSettings: React.FC<NetworkSettingsProps> = ({
  networkConfig,
  onSaveNetworkConfig,
  showToast,
}) => {
  const [name, setName] = useState("Home WiFi");
  const [subnet, setSubnet] = useState("192.168.1.0/24");
  const [gateway, setGateway] = useState("192.168.1.1");
  const [mode, setMode] = useState<DeviceMode>("direct");
  const [gatewayIp, setGatewayIp] = useState("192.168.1.100");
  const [gatewayPort, setGatewayPort] = useState(5000);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (networkConfig) {
      setName(networkConfig.name || "Home WiFi");
      setSubnet(networkConfig.subnet || "192.168.1.0/24");
      setGateway(networkConfig.gateway || "192.168.1.1");
      setMode(networkConfig.mode || "direct");
      setGatewayIp(networkConfig.gatewayIp || "192.168.1.100");
      setGatewayPort(networkConfig.gatewayPort || 5000);
    }
  }, [networkConfig]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveNetworkConfig({
        name,
        subnet,
        gateway,
        mode,
        gatewayIp,
        gatewayPort,
      });
      showToast(
        "success",
        "Network Updated",
        `Mode set to ${mode === "gateway" ? "Raspberry Pi Gateway" : "Direct ESP32"}`
      );
    } catch (err) {
      showToast("error", "Save failed", (err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const modes: { id: DeviceMode; label: string }[] = [
    { id: "direct", label: "Direct to ESP32" },
    { id: "gateway", label: "Raspberry Pi Gateway" },
  ];

  return (
    <form onSubmit={handleSave} className="space-y-8">
      <Group title="Network">
        <Row label="Name">
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={rowInput} />
        </Row>
        <Row label="Subnet">
          <input type="text" required value={subnet} onChange={(e) => setSubnet(e.target.value)} className={`${rowInput} font-mono`} />
        </Row>
        <Row label="Router">
          <input type="text" required value={gateway} onChange={(e) => setGateway(e.target.value)} className={`${rowInput} font-mono`} />
        </Row>
      </Group>

      <Group title="Connection">
        {modes.map((m) => (
          <Row key={m.id} label={m.label} onClick={() => setMode(m.id)}>
            {mode === m.id && <Check className="h-[18px] w-[18px] text-accent" strokeWidth={2.5} />}
          </Row>
        ))}
      </Group>

      <AnimatePresence initial={false}>
        {mode === "gateway" && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: easeApple }}
          >
            <Group title="Gateway">
              <Row label="IP Address">
                <input type="text" required value={gatewayIp} onChange={(e) => setGatewayIp(e.target.value)} className={`${rowInput} font-mono`} />
              </Row>
              <Row label="Port">
                <input
                  type="number"
                  required
                  value={gatewayPort}
                  onChange={(e) => setGatewayPort(Number(e.target.value))}
                  className={`${rowInput} font-mono`}
                />
              </Row>
            </Group>
          </motion.div>
        )}
      </AnimatePresence>

      <Button type="submit" disabled={isSaving} className="w-full py-2.5 text-[15px]">
        {isSaving ? "Saving…" : "Save"}
      </Button>
    </form>
  );
};

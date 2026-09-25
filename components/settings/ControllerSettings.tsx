"use client";

import React from "react";
import { Group, Row } from "./Group";
import { NetworkConfig } from "@/types";

interface ControllerSettingsProps {
  networkConfig: NetworkConfig | null;
}

export const ControllerSettings: React.FC<ControllerSettingsProps> = ({
  networkConfig,
}) => {
  return (
    <Group title="Raspberry Pi Gateway">
      <Row label="Host">
        <span className="font-mono text-[14px] text-muted">
          {networkConfig?.gatewayIp || "192.168.1.100"}:{networkConfig?.gatewayPort || 5000}
        </span>
      </Row>
      <Row label="Status">
        <span className="flex items-center gap-1.5 text-muted">
          <span className="h-2 w-2 rounded-full bg-[#34c759]" />
          Online
        </span>
      </Row>
      <Row label="Routing">
        <span className="text-muted">{networkConfig?.mode === "gateway" ? "Via Gateway" : "Direct"}</span>
      </Row>
    </Group>
  );
};

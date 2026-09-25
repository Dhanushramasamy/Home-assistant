"use client";

import React from "react";
import { ChevronRight, LogOut } from "lucide-react";
import { Group, Row } from "./Group";

interface AccountSettingsProps {
  username: string;
  role: "admin" | "user";
  onSwitchAccount: () => void;
  onSignOut: () => void;
}

export const AccountSettings: React.FC<AccountSettingsProps> = ({ username, role, onSwitchAccount, onSignOut }) => (
  <div className="space-y-6">
    <div className="glass flex items-center gap-4 rounded-[28px] p-4">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#f4f8a0] to-[#c9d23a] text-[22px] font-semibold uppercase text-[#151515]">
        {username.charAt(0)}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[18px] font-medium capitalize">{username}</p>
        <p className="text-[13px] text-muted">{role === "admin" ? "Administrator" : "Member"}</p>
      </div>
    </div>

    <Group>
      <Row label="Switch Account" onClick={onSwitchAccount}>
        <ChevronRight className="h-4 w-4 text-dim" />
      </Row>
      <Row label={<span className="text-danger">Sign Out</span>} onClick={onSignOut}>
        <LogOut className="h-4 w-4 text-danger" />
      </Row>
    </Group>
  </div>
);

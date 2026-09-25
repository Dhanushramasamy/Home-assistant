"use client";

import React, { useState } from "react";
import { createUserAccount } from "@/lib/userStore";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { Group, Row, rowInput } from "./Group";

interface GeneralSettingsProps {
  currentUserRole?: "admin" | "user";
}

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({
  currentUserRole = "admin",
}) => {
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [userRole, setUserRole] = useState<"user" | "admin">("user");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setIsCreating(true);

    try {
      const result = await createUserAccount(newUsername, newPassword, userRole);
      if (result.success) {
        setMsg({ type: "success", text: result.message });
        setNewUsername("");
        setNewPassword("");
      } else {
        setMsg({ type: "error", text: result.message });
      }
    } catch (err) {
      setMsg({ type: "error", text: (err as Error).message });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-8">
      <Group title="Account">
        <Row label="Role">
          <span className="text-muted">{currentUserRole === "admin" ? "Administrator" : "Member"}</span>
        </Row>
      </Group>

      {currentUserRole === "admin" && (
        <form onSubmit={handleCreateUser} className="space-y-3">
          <Group
            title="New User"
            footer={
              msg && <span className={msg.type === "success" ? "text-success" : "text-danger"}>{msg.text}</span>
            }
          >
            <Row label="Username">
              <input
                type="text"
                required
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Required"
                className={rowInput}
              />
            </Row>
            <Row label="Password">
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Required"
                className={rowInput}
              />
            </Row>
            <Row label="Administrator">
              <Switch
                checked={userRole === "admin"}
                onChange={() => setUserRole(userRole === "admin" ? "user" : "admin")}
                label="Administrator"
              />
            </Row>
          </Group>

          <Button
            type="submit"
            disabled={isCreating || !newUsername.trim() || !newPassword.trim()}
            className="w-full py-2.5 text-[15px]"
          >
            {isCreating ? "Creating…" : "Create User"}
          </Button>
        </form>
      )}
    </div>
  );
};

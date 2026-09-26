"use client";

import React, { useState } from "react";
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
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isChanging, setIsChanging] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    setIsChanging(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const result = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string };
      setPwMsg({ type: result.success ? "success" : "error", text: result.message || "Could not change the password." });
      if (result.success) {
        setCurrentPw("");
        setNewPw("");
      }
    } catch {
      setPwMsg({ type: "error", text: "Could not reach the server." });
    } finally {
      setIsChanging(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setIsCreating(true);

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername, password: newPassword, role: userRole }),
      });
      const result = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string; error?: string };
      if (!result.message) result.message = result.error || "Could not create the user.";
      if (result.success) {
        setMsg({ type: "success", text: result.message ?? "User created." });
        setNewUsername("");
        setNewPassword("");
      } else {
        setMsg({ type: "error", text: result.message ?? "Could not create the user." });
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

      <form onSubmit={handleChangePassword} className="space-y-3">
        <Group
          title="Change Password"
          footer={pwMsg && <span className={pwMsg.type === "success" ? "text-success" : "text-danger"}>{pwMsg.text}</span>}
        >
          <Row label="Current">
            <input
              type="password"
              required
              autoComplete="current-password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              placeholder="Current password"
              className={rowInput}
            />
          </Row>
          <Row label="New">
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="At least 6 characters"
              className={rowInput}
            />
          </Row>
        </Group>
        <Button
          type="submit"
          variant="secondary"
          disabled={isChanging || !currentPw || newPw.trim().length < 6}
          className="w-full py-2.5 text-[15px]"
        >
          {isChanging ? "Changing…" : "Change Password"}
        </Button>
      </form>

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

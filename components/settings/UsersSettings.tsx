"use client";

import React, { useEffect, useState } from "react";
import { Device } from "@/types";
import { Switch } from "@/components/ui/Switch";
import { Group, Row } from "./Group";

interface UserAccess {
  username: string;
  role: "admin" | "user";
  deviceIds: string[];
}

interface UsersSettingsProps {
  devices: Device[];
}

/** Admin screen: choose which devices each user can see and control. */
export const UsersSettings: React.FC<UsersSettingsProps> = ({ devices }) => {
  const [users, setUsers] = useState<UserAccess[] | null>(null);
  const [error, setError] = useState("");
  const [savingFor, setSavingFor] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/users", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setUsers(data.users ?? []))
      .catch(() => setError("Could not load users."));
  }, []);

  const toggle = async (username: string, deviceId: string) => {
    if (!users) return;
    const user = users.find((u) => u.username === username);
    if (!user) return;
    const next = user.deviceIds.includes(deviceId)
      ? user.deviceIds.filter((id) => id !== deviceId)
      : [...user.deviceIds, deviceId];

    setUsers(users.map((u) => (u.username === username ? { ...u, deviceIds: next } : u)));
    setSavingFor(username);
    setError("");
    try {
      const res = await fetch("/api/users/access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, deviceIds: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Put it back and say so.
      setUsers((prev) => prev?.map((u) => (u.username === username ? { ...u, deviceIds: user.deviceIds } : u)) ?? prev);
      setError(`Could not save access for ${username}.`);
    } finally {
      setSavingFor(null);
    }
  };

  if (error && !users) return <p className="px-4 text-[13px] text-danger">{error}</p>;
  if (!users) return <p className="px-4 text-[13px] text-muted">Loading users…</p>;

  return (
    <div className="space-y-6">
      <p className="px-4 text-[13px] text-muted">
        Choose which devices each person can see and switch. Administrators always have every device.
      </p>
      {error && <p className="px-4 text-[13px] text-danger">{error}</p>}

      {users.map((u) => (
        <Group
          key={u.username}
          title={`${u.username}${savingFor === u.username ? " · saving…" : ""}`}
          footer={u.role === "user" && u.deviceIds.length === 0 ? "No devices yet. This user sees an empty home." : undefined}
        >
          {u.role === "admin" ? (
            <Row label="Administrator">
              <span className="text-muted">All devices</span>
            </Row>
          ) : devices.length === 0 ? (
            <Row label="No devices added">
              <span />
            </Row>
          ) : (
            devices.map((d) => (
              <Row key={d.id} label={d.name}>
                <Switch
                  checked={u.deviceIds.includes(d.id)}
                  onChange={() => toggle(u.username, d.id)}
                  label={`${u.username} can use ${d.name}`}
                />
              </Row>
            ))
          )}
        </Group>
      ))}
    </div>
  );
};

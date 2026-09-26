"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Device } from "@/types";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/components/ui/Button";
import { Group, Row } from "./Group";

interface UserAccess {
  username: string;
  role: "admin" | "user";
  deviceIds: string[];
}

type Storage = "database" | "local" | "missing";

interface UsersSettingsProps {
  devices: Device[];
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

/**
 * Admin screen: choose which devices each user can see and control.
 * Changes are a draft until Save; after saving, the list is re-read from the
 * server and "Saved" is shown only if it really matches.
 */
export const UsersSettings: React.FC<UsersSettingsProps> = ({ devices }) => {
  const [saved, setSaved] = useState<UserAccess[] | null>(null);
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [storage, setStorage] = useState<Storage>("database");
  const [loadError, setLoadError] = useState("");
  const [status, setStatus] = useState<Record<string, { state: "saving" | "saved" | "error"; text?: string }>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/users", { cache: "no-store" });
    if (!res.ok) throw new Error();
    const data = (await res.json()) as { users: UserAccess[]; storage: Storage };
    setSaved(data.users ?? []);
    setStorage(data.storage ?? "database");
    return data.users ?? [];
  }, []);

  useEffect(() => {
    load()
      .then((users) => setDraft(Object.fromEntries(users.map((u) => [u.username, u.deviceIds]))))
      .catch(() => setLoadError("Could not load users."));
  }, [load]);

  // Warn before leaving the page with unsaved changes.
  const dirtyUsers = (saved ?? []).filter((u) => u.role === "user" && !sameSet(draft[u.username] ?? [], u.deviceIds));
  useEffect(() => {
    if (dirtyUsers.length === 0) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtyUsers.length]);

  const toggle = (username: string, deviceId: string) => {
    setDraft((d) => {
      const current = d[username] ?? [];
      return { ...d, [username]: current.includes(deviceId) ? current.filter((x) => x !== deviceId) : [...current, deviceId] };
    });
    setStatus((s) => ({ ...s, [username]: undefined as never }));
  };

  const save = async (username: string) => {
    const deviceIds = draft[username] ?? [];
    setStatus((s) => ({ ...s, [username]: { state: "saving" } }));
    try {
      const res = await fetch("/api/users/access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, deviceIds }),
      });
      const result = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string };
      if (!res.ok || !result.success) throw new Error(result.message || "Could not save.");

      // Confirm it really stuck by reading it back from the server.
      const users = await load();
      const stored = users.find((u) => u.username === username)?.deviceIds ?? [];
      if (!sameSet(stored, deviceIds)) throw new Error("The server didn't keep this change. Please try again.");
      setStatus((s) => ({ ...s, [username]: { state: "saved", text: result.message } }));
    } catch (err) {
      setStatus((s) => ({ ...s, [username]: { state: "error", text: (err as Error).message } }));
    }
  };

  if (loadError) return <p className="px-4 text-[13px] text-danger">{loadError}</p>;
  if (!saved) return <p className="px-4 text-[13px] text-muted">Loading users…</p>;

  return (
    <div className="space-y-6">
      <p className="px-4 text-[13px] text-muted">
        Choose which devices each person can see and switch, then tap Save. Administrators always have every device.
      </p>

      {storage !== "database" && (
        <div className="rounded-[14px] border border-danger/30 bg-danger/10 px-4 py-3 text-[13px] text-danger">
          {storage === "missing"
            ? "Access can't be saved yet: run supabase/add_device_access.sql in Supabase."
            : "Saving on this computer only. Run supabase/add_device_access.sql in Supabase so it's stored in the database."}
        </div>
      )}

      {saved.map((u) => {
        const selected = draft[u.username] ?? [];
        const dirty = u.role === "user" && !sameSet(selected, u.deviceIds);
        const st = status[u.username];
        return (
          <div key={u.username} className="space-y-2">
            <Group
              title={u.username}
              footer={
                u.role === "user" && selected.length === 0 ? "No devices: this user sees an empty home." : undefined
              }
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
                      checked={selected.includes(d.id)}
                      onChange={() => toggle(u.username, d.id)}
                      label={`${u.username} can use ${d.name}`}
                    />
                  </Row>
                ))
              )}
            </Group>

            {u.role === "user" && devices.length > 0 && (
              <div className="flex items-center justify-between gap-3 px-1">
                <span
                  className={`text-[13px] ${
                    st?.state === "error" ? "text-danger" : st?.state === "saved" ? "text-success" : "text-muted"
                  }`}
                >
                  {st?.state === "saving"
                    ? "Saving…"
                    : st?.state === "error"
                      ? st.text
                      : dirty
                        ? "Unsaved changes"
                        : st?.state === "saved"
                          ? st.text && st.text !== "Saved." ? st.text : "Saved ✓"
                          : ""}
                </span>
                <Button
                  onClick={() => save(u.username)}
                  disabled={!dirty || st?.state === "saving"}
                  className="shrink-0 px-5 py-2 text-[14px]"
                  aria-label={`Save access for ${u.username}`}
                >
                  {st?.state === "saving" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : st?.state === "saved" && !dirty ? (
                    <>
                      <Check className="h-4 w-4" /> Saved
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Download, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { BOARD_SAFE_PINS, BoardSetupInput, CloudBoard, DEFAULT_RELAY_PINS, MAX_BOARD_RELAYS, MAX_BOARD_WIFI } from "@/types";
import { Button } from "@/components/ui/Button";
import { Group, Row, rowInput } from "./Group";

type Toast = (type: "success" | "error" | "info" | "warning", title: string, desc?: string) => void;

interface WifiDraft {
  key: number;
  ssid: string;
  /** Typed password; empty = keep the saved one (if any). */
  password: string;
  /** Name it was saved under, to keep its password after a rename. */
  originalSsid?: string;
  hasPassword: boolean;
}

interface Draft {
  boardId: string;
  isNew: boolean;
  name: string;
  relayPins: number[];
  relayActiveLow: boolean;
  wifi: WifiDraft[];
}

const REFRESH_MS = 10_000;
let nextKey = 1;

function ago(iso: string | null): string {
  if (!iso) return "never";
  const sec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.round(sec / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

function draftOf(board: CloudBoard): Draft {
  return {
    boardId: board.boardId,
    isNew: false,
    name: board.name ?? board.boardId,
    relayPins: board.relayPins.length ? board.relayPins : [DEFAULT_RELAY_PINS[0]],
    relayActiveLow: board.relayActiveLow,
    wifi: board.wifi.map((w) => ({ key: nextKey++, ssid: w.ssid, password: "", originalSsid: w.ssid, hasPassword: w.hasPassword })),
  };
}

function newDraft(boards: CloudBoard[]): Draft {
  let n = 202;
  while (boards.some((b) => b.boardId === `esp${n}`)) n++;
  return {
    boardId: `esp${n}`,
    isNew: true,
    name: "",
    relayPins: [DEFAULT_RELAY_PINS[0]],
    relayActiveLow: true,
    wifi: [{ key: nextKey++, ssid: "", password: "", hasPassword: false }],
  };
}

function inputOf(d: Draft): BoardSetupInput {
  return {
    name: d.name,
    relayPins: d.relayPins,
    relayActiveLow: d.relayActiveLow,
    wifi: d.wifi.map((w) => ({
      ssid: w.ssid.trim(),
      // Empty with a saved password = keep it; empty without = open network.
      ...(w.password || !w.hasPassword ? { password: w.password } : {}),
      ...(w.originalSsid ? { originalSsid: w.originalSsid } : {}),
    })),
  };
}

const field = "w-full rounded-[10px] bg-white/[0.06] px-3 py-2 text-[15px] text-ink placeholder:text-dim focus:outline-none focus:ring-1 focus:ring-white/20";
const iconBtn = "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-white/[0.08] disabled:opacity-30";

/**
 * Admin: every ESP32 board, its live state, and its setup (relays, Wi-Fi in
 * priority order). Saving creates the board's own sign-in; Download code
 * gives a ready Arduino folder to upload.
 */
export const BoardsSettings: React.FC<{ showToast: Toast }> = ({ showToast }) => {
  const [boards, setBoards] = useState<CloudBoard[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"save" | "code" | "delete" | null>(null);
  const [shown, setShown] = useState<Record<number, boolean>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/boards", { cache: "no-store" });
      const body = (await res.json()) as { boards?: CloudBoard[]; error?: string };
      setBoards(body.boards ?? []);
      setProblem(body.error ?? null);
    } catch {
      setProblem("Couldn't load boards.");
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load]);

  const edit = (change: (d: Draft) => Draft) => {
    setDraft((d) => (d ? change(d) : d));
    setDirty(true);
  };

  const setRelayCount = (count: number) =>
    edit((d) => {
      const pins = d.relayPins.slice(0, count);
      while (pins.length < count) {
        pins.push(DEFAULT_RELAY_PINS.find((p) => !pins.includes(p)) ?? BOARD_SAFE_PINS.find((p) => !pins.includes(p))!);
      }
      return { ...d, relayPins: pins };
    });

  const moveWifi = (index: number, by: number) =>
    edit((d) => {
      const wifi = [...d.wifi];
      const [item] = wifi.splice(index, 1);
      wifi.splice(index + by, 0, item);
      return { ...d, wifi };
    });

  const save = async (d: Draft): Promise<boolean> => {
    const res = await fetch(`/api/boards/${encodeURIComponent(d.boardId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inputOf(d)),
    });
    const body = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
    if (!res.ok || !body.success) {
      showToast("error", "Not saved", body.error ?? "Please try again.");
      return false;
    }
    setDirty(false);
    await load();
    return true;
  };

  const handleSave = async () => {
    if (!draft) return;
    setBusy("save");
    try {
      if (await save(draft)) {
        showToast("success", draft.isNew ? "Board added" : "Board saved", "Now download its code and upload it.");
        setDraft((d) => (d ? { ...d, isNew: false, wifi: d.wifi.map((w) => ({ ...w, password: "", originalSsid: w.ssid.trim(), hasPassword: true })) } : d));
      }
    } finally {
      setBusy(null);
    }
  };

  const handleDownload = async () => {
    if (!draft) return;
    setBusy("code");
    try {
      if (dirty || draft.isNew) {
        if (!(await save(draft))) return;
        setDraft((d) => (d ? { ...d, isNew: false, wifi: d.wifi.map((w) => ({ ...w, password: "", originalSsid: w.ssid.trim(), hasPassword: true })) } : d));
      }
      const res = await fetch(`/api/boards/${encodeURIComponent(draft.boardId)}/code`, { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        showToast("error", "No code", body.error ?? "Please try again.");
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `${draft.boardId}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      showToast("success", "Code downloaded", `Unzip ${draft.boardId}.zip, open it in Arduino IDE and upload.`);
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    if (!draft || draft.isNew) return;
    if (!window.confirm(`Delete board ${draft.boardId}? Its switches stay in the app but stop working until linked to another board.`)) return;
    setBusy("delete");
    try {
      const res = await fetch(`/api/boards/${encodeURIComponent(draft.boardId)}`, { method: "DELETE" });
      if (!res.ok) {
        showToast("error", "Not deleted", "Please try again.");
        return;
      }
      showToast("success", "Board deleted");
      setDraft(null);
      setDirty(false);
      await load();
    } finally {
      setBusy(null);
    }
  };

  // ---------------------------------------------------------------- list
  if (!draft) {
    return (
      <div className="space-y-6">
        <Group title="Boards" footer={problem ?? "Each ESP32. They check in every minute; offline after 2½ minutes without one."}>
          {boards === null ? (
            <Row label={<span className="text-muted">Loading…</span>} />
          ) : boards.length === 0 ? (
            <Row label={<span className="text-muted">No boards yet</span>} />
          ) : (
            boards.map((b) => (
              <button
                key={b.boardId}
                type="button"
                onClick={() => {
                  setDraft(draftOf(b));
                  setDirty(false);
                }}
                className="block w-full px-4 py-2.5 text-left text-[15px] transition-colors hover:bg-white/[0.08]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${b.online ? "bg-accent" : "bg-white/25"}`} aria-label={b.online ? "Online" : "Offline"} />
                    <span className="truncate">{b.name || b.boardId}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[13px] text-muted">{b.boardId} ›</span>
                </div>
                <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 pl-4 text-[13px] text-muted">
                  <span>Network</span>
                  <span className="truncate text-right">{b.ssid ?? "—"}</span>
                  <span>IP</span>
                  <span className="text-right font-mono">{b.ip ?? "—"}</span>
                  <span>Relays · Wi-Fi saved</span>
                  <span className="text-right">
                    {b.relayPins.length || "—"} · {b.wifi.length || "none"}
                  </span>
                  <span>Last seen</span>
                  <span className="text-right">{b.linked ? ago(b.lastSeen) : "not set up"}</span>
                  {b.restart && (
                    <>
                      <span>Last restart</span>
                      <span className={`text-right ${/dip|crash|watchdog/.test(b.restart.reason) ? "text-tint-light" : ""}`}>
                        {b.restart.reason}
                        {b.restart.at ? ` · ${ago(b.restart.at)}` : ""}
                      </span>
                    </>
                  )}
                  {b.restart?.timers && b.restart.timers.back + b.restart.timers.late + b.restart.timers.dropped > 0 && (
                    <>
                      <span>Timers after it</span>
                      <span className="text-right">
                        {b.restart.timers.back} back · {b.restart.timers.late} run late · {b.restart.timers.dropped} dropped
                      </span>
                    </>
                  )}
                </div>
              </button>
            ))
          )}
        </Group>

        <Button
          type="button"
          onClick={() => {
            setDraft(newDraft(boards ?? []));
            setDirty(true);
          }}
          className="w-full py-2.5 text-[15px]"
        >
          <Plus className="h-4 w-4" /> Add board
        </Button>
      </div>
    );
  }

  // -------------------------------------------------------------- editor
  const d = draft;
  return (
    <div className="space-y-6">
      <button type="button" onClick={() => setDraft(null)} className="text-[15px] text-accent">
        ‹ Boards
      </button>

      <Group title={d.isNew ? "New board" : "Board"} footer={d.isNew ? "Name: lower-case letters, digits or dashes. It can't be changed later." : undefined}>
        <Row label="Name">
          <input
            value={d.boardId}
            disabled={!d.isNew}
            onChange={(e) => edit((x) => ({ ...x, boardId: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
            placeholder="esp202"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={`${rowInput} font-mono disabled:opacity-60`}
          />
        </Row>
        <Row label="Label">
          <input value={d.name} onChange={(e) => edit((x) => ({ ...x, name: e.target.value }))} placeholder="Hall" className={rowInput} />
        </Row>
      </Group>

      <Group title="Relays" footer="The usual pins are filled in. Change them only if your board is wired differently.">
        <Row label="Number of relays">
          <span className="flex items-center gap-2">
            <button type="button" className={iconBtn} disabled={d.relayPins.length <= 1} onClick={() => setRelayCount(d.relayPins.length - 1)} aria-label="One relay less">
              −
            </button>
            <span className="w-5 text-center">{d.relayPins.length}</span>
            <button
              type="button"
              className={iconBtn}
              disabled={d.relayPins.length >= MAX_BOARD_RELAYS}
              onClick={() => setRelayCount(d.relayPins.length + 1)}
              aria-label="One relay more"
            >
              +
            </button>
          </span>
        </Row>
        {d.relayPins.map((pin, i) => (
          <Row key={i} label={`Relay ${i + 1} pin`}>
            <select
              value={pin}
              onChange={(e) => edit((x) => ({ ...x, relayPins: x.relayPins.map((p, j) => (j === i ? Number(e.target.value) : p)) }))}
              className="bg-transparent text-right text-[15px] text-muted focus:outline-none"
            >
              {BOARD_SAFE_PINS.filter((p) => p === pin || !d.relayPins.includes(p)).map((p) => (
                <option key={p} value={p}>
                  GPIO {p}
                </option>
              ))}
            </select>
          </Row>
        ))}
        <Row label="Relay turns on when pin is" onClick={() => edit((x) => ({ ...x, relayActiveLow: !x.relayActiveLow }))}>
          <span className="text-[15px] text-muted">{d.relayActiveLow ? "LOW (most modules)" : "HIGH"}</span>
        </Row>
      </Group>

      <Group title="Wi-Fi networks" footer="Priority 1 is tried first. The board joins the first one in range, and gets its address from that Wi-Fi.">
        {d.wifi.map((w, i) => (
          <div key={w.key} className="space-y-2 px-4 py-3">
            <div className="flex items-center gap-1">
              <span className="w-16 shrink-0 text-[13px] text-muted">Priority {i + 1}</span>
              <span className="flex-1" />
              <button type="button" className={iconBtn} disabled={i === 0} onClick={() => moveWifi(i, -1)} aria-label="Higher priority">
                <ChevronUp className="h-4 w-4" />
              </button>
              <button type="button" className={iconBtn} disabled={i === d.wifi.length - 1} onClick={() => moveWifi(i, 1)} aria-label="Lower priority">
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={iconBtn}
                disabled={d.wifi.length <= 1}
                onClick={() => edit((x) => ({ ...x, wifi: x.wifi.filter((_, j) => j !== i) }))}
                aria-label="Remove network"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <input
              value={w.ssid}
              onChange={(e) => edit((x) => ({ ...x, wifi: x.wifi.map((v, j) => (j === i ? { ...v, ssid: e.target.value } : v)) }))}
              placeholder="Wi-Fi name (exactly as on your phone)"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={field}
            />
            <div className="relative">
              <input
                type={shown[w.key] ? "text" : "password"}
                value={w.password}
                onChange={(e) => edit((x) => ({ ...x, wifi: x.wifi.map((v, j) => (j === i ? { ...v, password: e.target.value } : v)) }))}
                placeholder={w.hasPassword ? "Saved — type to change" : "Password (empty for an open network)"}
                autoComplete="new-password"
                className={`${field} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShown((s) => ({ ...s, [w.key]: !s[w.key] }))}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-muted"
                aria-label={shown[w.key] ? "Hide password" : "Show password"}
              >
                {shown[w.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        ))}
        {d.wifi.length < MAX_BOARD_WIFI && (
          <Row
            label={
              <span className="text-accent">
                <Plus className="mr-1 inline h-4 w-4" /> Add Wi-Fi
              </span>
            }
            onClick={() => edit((x) => ({ ...x, wifi: [...x.wifi, { key: nextKey++, ssid: "", password: "", hasPassword: false }] }))}
          />
        )}
      </Group>

      <div className="space-y-3">
        <Button type="button" onClick={handleSave} disabled={busy !== null || !dirty} className="w-full py-2.5 text-[15px]">
          {busy === "save" ? "Saving…" : d.isNew ? "Add board" : "Save"}
        </Button>
        <Button type="button" variant="secondary" onClick={handleDownload} disabled={busy !== null} className="w-full py-2.5 text-[15px]">
          <Download className="h-4 w-4" />
          {busy === "code" ? "Preparing…" : dirty || d.isNew ? "Save and download code" : "Download code"}
        </Button>
        {!d.isNew && (
          <Button type="button" variant="danger" onClick={handleDelete} disabled={busy !== null} className="w-full py-2.5 text-[15px]">
            {busy === "delete" ? "Deleting…" : "Delete board"}
          </Button>
        )}
      </div>

      <Group title="Then">
        <div className="space-y-1.5 px-4 py-3 text-[13px] text-muted">
          <p>1. Unzip the download and open the .ino file in Arduino IDE.</p>
          <p>2. First time only: install the &quot;esp32&quot; boards, and the &quot;WebSockets&quot; and &quot;ArduinoJson&quot; libraries.</p>
          <p>3. Tools → Board → ESP32 Dev Module, pick the port, click Upload.</p>
          <p>4. The board shows online here within a minute. Add its switches with the + button (Board = {d.boardId}).</p>
          <p>The download has your Wi-Fi passwords. Keep it private.</p>
        </div>
      </Group>
    </div>
  );
};

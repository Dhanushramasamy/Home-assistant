"use client";

import React, { useCallback, useEffect, useState } from "react";
import { CloudBoard } from "@/types";
import { Group, Row } from "./Group";

const REFRESH_MS = 10_000;

function ago(iso: string | null): string {
  if (!iso) return "never";
  const sec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.round(sec / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Each cloud board's current network and IP, as it reported them. Works from
 * any network, so the IP is visible even on a phone hotspot.
 */
export const CloudBoards: React.FC = () => {
  const [boards, setBoards] = useState<CloudBoard[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

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

  const footer = problem ?? "Boards check in every minute. Offline after 2½ minutes without one.";

  return (
    <Group title="Cloud Boards" footer={footer}>
      {boards === null ? (
        <Row label={<span className="text-muted">Loading…</span>} />
      ) : boards.length === 0 ? (
        <Row label={<span className="text-muted">No boards yet</span>} />
      ) : (
        boards.map((b) => (
          <div key={b.boardId} className="px-4 py-2.5 text-[15px]">
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${b.online ? "bg-accent" : "bg-white/25"}`}
                  aria-label={b.online ? "Online" : "Offline"}
                />
                <span className="truncate">{b.name || b.boardId}</span>
              </span>
              <span className="shrink-0 font-mono text-[13px] text-muted">{b.boardId}</span>
            </div>
            <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 pl-4 text-[13px] text-muted">
              <span>Network</span>
              <span className="truncate text-right">{b.ssid ?? "—"}</span>
              <span>IP</span>
              <span className="text-right font-mono">{b.ip ?? "—"}</span>
              <span>Signal</span>
              <span className="text-right">{b.rssi != null ? `${b.rssi} dBm` : "—"}</span>
              <span>Last seen</span>
              <span className="text-right">{b.linked ? ago(b.lastSeen) : "no sign-in linked"}</span>
            </div>
          </div>
        ))
      )}
    </Group>
  );
};

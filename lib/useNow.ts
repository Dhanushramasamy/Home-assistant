"use client";

import { useEffect, useState } from "react";

/** Current time, re-rendered every second while `active` (for local countdowns). */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    // Catch up at once: while inactive the value went stale, and a countdown
    // that starts from it shows a wrong number for a second.
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [active]);
  return now;
}

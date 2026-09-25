"use client";

import { useEffect, useRef } from "react";

/**
 * Makes the browser/Android back gesture close the top-most open layer
 * (sheet, settings, search...) instead of leaving the app.
 *
 * Each open layer pushes one history entry. Back pops it and closes that layer.
 * Closing a layer from the UI removes its entry again with history.back(),
 * whose popstate is ignored so nothing else closes.
 */
type Entry = { close: () => void };

const stack: Entry[] = [];
let ignorePops = 0;
let listening = false;

function onPopState() {
  if (ignorePops > 0) {
    ignorePops--;
    return;
  }
  stack.pop()?.close();
}

export function useBackClose(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    if (!listening) {
      window.addEventListener("popstate", onPopState);
      listening = true;
    }

    let closedByBack = false;
    const entry: Entry = {
      close: () => {
        closedByBack = true;
        closeRef.current();
      },
    };
    stack.push(entry);
    window.history.pushState({ homeControlLayer: true }, "");

    return () => {
      const index = stack.indexOf(entry);
      if (index !== -1) stack.splice(index, 1);
      if (!closedByBack) {
        ignorePops++;
        window.history.back();
      }
    };
  }, [open]);
}

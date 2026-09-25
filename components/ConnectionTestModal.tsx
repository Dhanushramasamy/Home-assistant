"use client";

import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { TestConnectionResponse } from "@/types";
import { Check, X, Loader2 } from "lucide-react";
import { ModalShell } from "./ui/ModalShell";
import { Button } from "./ui/Button";
import { easeApple } from "@/lib/deviceTheme";

interface ConnectionTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: TestConnectionResponse | null;
  isLoading: boolean;
  deviceName?: string;
}

export const ConnectionTestModal: React.FC<ConnectionTestModalProps> = ({
  isOpen,
  onClose,
  result,
  isLoading,
  deviceName = "Device",
}) => {
  const rows = result
    ? [
        { label: "IP Address", value: result.ip },
        { label: "Mode", value: result.mode === "gateway" ? "Pi Gateway" : "Direct" },
        ...(result.responseTimeMs !== undefined ? [{ label: "Response", value: `${result.responseTimeMs} ms` }] : []),
      ]
    : [];

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} className="max-w-sm">
      <div className="p-6">
        <AnimatePresence mode="wait" initial={false}>
          {isLoading || !result ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center py-8"
            >
              <Loader2 className="h-8 w-8 animate-spin text-dim" />
              <p className="mt-4 text-[15px] text-muted">Checking {deviceName}…</p>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: easeApple }}
            >
              <div className="flex flex-col items-center text-center">
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.05 }}
                  className={`flex h-14 w-14 items-center justify-center rounded-full ${
                    result.reachable ? "bg-success" : "bg-danger"
                  }`}
                >
                  {result.reachable ? (
                    <Check className="h-7 w-7 text-[#151515]" strokeWidth={3} />
                  ) : (
                    <X className="h-7 w-7 text-white" strokeWidth={3} />
                  )}
                </motion.div>
                <h3 className="mt-4 text-lg font-semibold tracking-tight">
                  {result.reachable ? "Connected" : "Not Reachable"}
                </h3>
                <p className="mt-0.5 text-[13px] text-muted">{deviceName}</p>
              </div>

              <div className="mt-6 divide-y divide-line overflow-hidden rounded-xl bg-white/[0.06] text-[15px]">
                {rows.map((r) => (
                  <div key={r.label} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-muted">{r.label}</span>
                    <span className="font-mono text-[14px]">{r.value}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Button onClick={onClose} className="mt-6 w-full py-2.5 text-[15px]">
          Done
        </Button>
      </div>
    </ModalShell>
  );
};

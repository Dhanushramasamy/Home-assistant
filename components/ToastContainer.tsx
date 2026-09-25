"use client";

import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ToastMessage } from "@/types";
import { CheckCircle2, AlertCircle, Info, XCircle, type LucideIcon } from "lucide-react";
import { easeApple } from "@/lib/deviceTheme";

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const toastIcons: Record<ToastMessage["type"], { icon: LucideIcon; color: string }> = {
  success: { icon: CheckCircle2, color: "#e8f047" },
  error: { icon: XCircle, color: "#ff453a" },
  warning: { icon: AlertCircle, color: "#ff9f0a" },
  info: { icon: Info, color: "#0a84ff" },
};

/** iOS-style HUD pill, top centre. Shows only the latest message. */
export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  const toast = toasts[toasts.length - 1];

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center px-4">
      <AnimatePresence mode="wait">
        {toast && (
          <motion.button
            key={toast.id}
            onClick={() => onDismiss(toast.id)}
            initial={{ opacity: 0, y: -20, scaleX: 0.6, scaleY: 0.8 }}
            animate={{ opacity: 1, y: 0, scaleX: 1, scaleY: 1 }}
            exit={{ opacity: 0, y: -14, scaleX: 0.7, scaleY: 0.85, transition: { duration: 0.25, ease: easeApple } }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            className="pointer-events-auto flex max-w-sm items-center gap-2 rounded-full border border-white/10 bg-[#26272c]/90 py-2.5 pl-3 pr-4 text-left text-[13px] font-medium text-white shadow-[0_8px_30px_rgba(0,0,0,0.2)] backdrop-blur-xl"
          >
            {React.createElement(toastIcons[toast.type]?.icon ?? Info, {
              className: "h-4 w-4 shrink-0",
              style: { color: toastIcons[toast.type]?.color },
            })}
            <span className="truncate">{toast.title.replace(/^[✓✕]\s*/, "")}</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

"use client";

import React, { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { easeApple } from "@/lib/deviceTheme";
import { useBackClose } from "@/lib/useBackClose";

interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

/** Dark glass sheet: dimmed backdrop, panel that springs up from below. */
export const ModalShell: React.FC<ModalShellProps> = ({ isOpen, onClose, children, className = "max-w-md" }) => {
  useBackClose(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={`relative w-full ${className}`}
            initial={{ y: 60, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0, scale: 0.98, transition: { duration: 0.25, ease: easeApple } }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
          >
            <div className="relative flex max-h-[92vh] flex-col overflow-hidden rounded-t-[32px] border border-white/10 bg-[#1b1c20]/95 text-ink shadow-[0_30px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl sm:rounded-[32px]">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

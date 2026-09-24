"use client";

import React from "react";
import { ToastMessage } from "@/types";
import { CheckCircle2, AlertCircle, Info, XCircle, X } from "lucide-react";

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
}) => {
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-3 max-w-sm w-full px-4 sm:px-0 pointer-events-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === "success";
        const isError = toast.type === "error";
        const isWarning = toast.type === "warning";

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start p-4 rounded-xl shadow-xl backdrop-blur-md border transition-all transform duration-300 animate-in slide-in-from-bottom-3 ${
              isSuccess
                ? "bg-slate-900/90 border-emerald-500/40 text-slate-100 shadow-emerald-500/10"
                : isError
                ? "bg-slate-900/90 border-rose-500/40 text-slate-100 shadow-rose-500/10"
                : isWarning
                ? "bg-slate-900/90 border-amber-500/40 text-slate-100 shadow-amber-500/10"
                : "bg-slate-900/90 border-cyan-500/40 text-slate-100 shadow-cyan-500/10"
            }`}
          >
            <div className="mr-3 mt-0.5 shrink-0">
              {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              {isError && <XCircle className="w-5 h-5 text-rose-400" />}
              {isWarning && <AlertCircle className="w-5 h-5 text-amber-400" />}
              {!isSuccess && !isError && !isWarning && (
                <Info className="w-5 h-5 text-cyan-400" />
              )}
            </div>

            <div className="flex-1 pr-2">
              <h4 className="text-sm font-semibold tracking-wide">{toast.title}</h4>
              {toast.description && (
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  {toast.description}
                </p>
              )}
            </div>

            <button
              onClick={() => onDismiss(toast.id)}
              className="text-slate-400 hover:text-slate-200 p-1 rounded-lg transition-colors shrink-0"
              aria-label="Dismiss toast"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

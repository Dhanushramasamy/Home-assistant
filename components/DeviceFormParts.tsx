"use client";

import React from "react";
import { motion } from "motion/react";
import { DeviceMode, DeviceType } from "@/types";
import { Lightbulb, Fan, Plug, Cpu } from "lucide-react";
import { deviceAccent, springs } from "@/lib/deviceTheme";

/** iOS form-sheet header: Cancel · Title · Confirm (submits the form). */
export const SheetHeader: React.FC<{
  title: string;
  confirmLabel: string;
  canConfirm: boolean;
  onCancel: () => void;
}> = ({ title, confirmLabel, canConfirm, onCancel }) => (
  <div className="grid shrink-0 grid-cols-3 items-center border-b border-line bg-white/[0.06] px-4 py-3.5">
    <button type="button" onClick={onCancel} className="justify-self-start text-[17px] text-accent">
      Cancel
    </button>
    <h3 className="text-center text-[17px] font-semibold">{title}</h3>
    <button
      type="submit"
      disabled={!canConfirm}
      className="justify-self-end text-[17px] font-semibold text-accent disabled:text-dim"
    >
      {confirmLabel}
    </button>
  </div>
);

export const FormGroup: React.FC<{ caption?: string; footer?: React.ReactNode; children: React.ReactNode }> = ({
  caption,
  footer,
  children,
}) => (
  <section>
    {caption && <p className="mb-1.5 px-4 text-[13px] text-muted">{caption}</p>}
    <div className="divide-y divide-line overflow-hidden rounded-[14px] bg-white/[0.06]">{children}</div>
    {footer && <div className="mt-1.5 px-4 text-[13px]">{footer}</div>}
  </section>
);

export const FormRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="flex min-h-[44px] items-center justify-between gap-4 px-4 py-2">
    <span className="shrink-0 text-[17px]">{label}</span>
    <div className="flex min-w-0 flex-1 justify-end">{children}</div>
  </label>
);

export const rowInput =
  "w-full bg-transparent text-right text-[17px] text-ink placeholder:text-dim focus:outline-none";
export const rowSelect =
  "appearance-none bg-transparent text-right text-[17px] text-muted focus:outline-none cursor-pointer";

const typeOptions = [
  { id: "light", label: "Light", icon: Lightbulb },
  { id: "fan", label: "Fan", icon: Fan },
  { id: "plug", label: "Plug", icon: Plug },
  { id: "other", label: "Other", icon: Cpu },
] as const;

export const TypePicker: React.FC<{ value: DeviceType; onChange: (t: DeviceType) => void }> = ({ value, onChange }) => (
  <div className="grid grid-cols-4 gap-2 px-2 py-4">
    {typeOptions.map((item) => {
      const selected = value === item.id;
      return (
        <button key={item.id} type="button" onClick={() => onChange(item.id)} className="flex flex-col items-center gap-1.5">
          <motion.span
            whileTap={{ scale: 0.9 }}
            className="flex h-12 w-12 items-center justify-center rounded-full transition-colors duration-200"
            style={{ backgroundColor: selected ? deviceAccent[item.id].hex : "rgb(255 255 255 / 0.07)" }}
          >
            <item.icon className="h-5 w-5" style={{ color: selected ? "#151515" : "#a1a1aa" }} />
          </motion.span>
          <span className={`text-[13px] ${selected ? "text-ink" : "text-muted"}`}>{item.label}</span>
        </button>
      );
    })}
  </div>
);

export const ModeSegment: React.FC<{ value: DeviceMode; onChange: (m: DeviceMode) => void; layoutId: string }> = ({
  value,
  onChange,
  layoutId,
}) => (
  <div className="p-2">
    <div className="grid grid-cols-2 rounded-[10px] bg-white/[0.06] p-0.5 text-[13px] font-medium">
      {(
        [
          { id: "direct", label: "Direct" },
          { id: "gateway", label: "Pi Gateway" },
        ] as const
      ).map((m) => (
        <button key={m.id} type="button" onClick={() => onChange(m.id)} className="relative rounded-[8px] py-1.5">
          {value === m.id && (
            <motion.span
              layoutId={layoutId}
              transition={springs.snappy}
              className="absolute inset-0 rounded-[8px] bg-white/[0.16] shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
            />
          )}
          <span className="relative">{m.label}</span>
        </button>
      ))}
    </div>
  </div>
);

export const IpInput: React.FC<{
  octets: [string, string, string, string];
  onChange: (index: number, value: string) => void;
}> = ({ octets, onChange }) => (
  <div className="flex items-center justify-end font-mono text-[17px]">
    {octets.map((o, i) => (
      <React.Fragment key={i}>
        {i > 0 && <span className="text-dim">.</span>}
        <input
          type="text"
          inputMode="numeric"
          value={o}
          onChange={(e) => onChange(i, e.target.value)}
          aria-label={`IP octet ${i + 1}`}
          style={{ width: `${Math.max(o.length, 1)}ch` }}
          className="bg-transparent text-center text-ink focus:text-accent focus:outline-none"
        />
      </React.Fragment>
    ))}
  </div>
);

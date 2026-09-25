"use client";

import React from "react";

/** iOS Settings style inset grouped list. */
export const Group: React.FC<{ title?: string; footer?: React.ReactNode; children: React.ReactNode }> = ({
  title,
  footer,
  children,
}) => (
  <section>
    {title && <h3 className="mb-1.5 px-4 text-[13px] text-muted">{title}</h3>}
    <div className="divide-y divide-line overflow-hidden rounded-[14px] bg-white/[0.06]">{children}</div>
    {footer && <div className="mt-1.5 px-4 text-[13px] text-muted">{footer}</div>}
  </section>
);

export const Row: React.FC<{ label: React.ReactNode; children?: React.ReactNode; onClick?: () => void; className?: string }> = ({
  label,
  children,
  onClick,
  className = "",
}) => {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`flex min-h-[44px] w-full items-center justify-between gap-4 px-4 py-2.5 text-left text-[15px] ${
        onClick ? "transition-colors hover:bg-white/[0.08] active:bg-white/[0.08]" : ""
      } ${className}`}
    >
      <span className="shrink-0">{label}</span>
      {children}
    </Tag>
  );
};

/** Borderless right-aligned input for use inside a Row. */
export const rowInput =
  "min-w-0 flex-1 bg-transparent text-right text-[15px] text-muted placeholder:text-dim focus:text-ink focus:outline-none";

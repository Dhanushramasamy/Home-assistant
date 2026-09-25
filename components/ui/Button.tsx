"use client";

import React from "react";
import { motion, HTMLMotionProps } from "motion/react";

type Variant = "primary" | "secondary" | "danger";

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: Variant;
  children: React.ReactNode;
}

const variants: Record<Variant, string> = {
  primary: "bg-accent sheen text-accent-ink shadow-[0_8px_24px_-10px_rgba(232,240,71,0.6)] hover:bg-accent-hover",
  secondary: "glass-btn text-ink",
  danger: "bg-danger/10 text-danger hover:bg-danger/15",
};

export const Button: React.FC<ButtonProps> = ({ variant = "primary", className = "", children, ...rest }) => (
  <motion.button
    whileTap={{ scale: 0.97 }}
    transition={{ duration: 0.12 }}
    className={`inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-[background-color,box-shadow] disabled:opacity-40 disabled:pointer-events-none ${variants[variant]} ${className}`}
    {...rest}
  >
    {children}
  </motion.button>
);

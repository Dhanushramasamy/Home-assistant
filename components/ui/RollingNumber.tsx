"use client";

import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { easeApple } from "@/lib/deviceTheme";

/** Number that rolls vertically when it changes, like the iOS clock digits. */
export const RollingNumber: React.FC<{ value: number }> = ({ value }) => (
  <span className="relative inline-flex overflow-hidden align-bottom tabular-nums">
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={value}
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "-100%", opacity: 0 }}
        transition={{ duration: 0.4, ease: easeApple }}
      >
        {value}
      </motion.span>
    </AnimatePresence>
  </span>
);

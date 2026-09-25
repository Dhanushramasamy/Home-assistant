"use client";

import React, { useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "motion/react";
import { loginUser } from "@/lib/userStore";
import { ArrowRight, House, Loader2 } from "lucide-react";
import { easeApple } from "@/lib/deviceTheme";
import { Backdrop } from "./ui/Backdrop";

interface LoginPageProps {
  onLoginSuccess: (username: string, role: "admin" | "user") => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const shake = useAnimationControls();

  const fail = (msg: string) => {
    setErrorMsg(msg);
    shake.start({ x: [0, -8, 8, -5, 5, 0], transition: { duration: 0.4 } });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsLoading(true);

    try {
      const result = await loginUser(username, password);
      if (result.success) {
        onLoginSuccess(result.username, result.role);
      } else {
        fail(result.message);
      }
    } catch (err) {
      fail((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const canSubmit = username.trim() && password && !isLoading;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4">
      <Backdrop />
      <div className="flex w-full max-w-[360px] flex-col">
        <motion.div
          initial={{ scale: 0.5, opacity: 0, rotate: -12 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="mb-8"
        >
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="glass-btn flex h-16 w-16 items-center justify-center rounded-full"
          >
            <House className="h-7 w-7 text-accent" style={{ filter: "drop-shadow(0 0 8px rgb(232 240 71 / 0.6))" }} strokeWidth={1.8} />
          </motion.div>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easeApple, delay: 0.15 }}
          className="mb-10 text-[40px] font-medium leading-[1.1] tracking-tight text-ink"
        >
          Hi there!
          <br />
          Welcome Home
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easeApple, delay: 0.25 }}
          className="w-full"
        >
        <motion.form animate={shake} onSubmit={handleSubmit} className="w-full">
          <div className="glass overflow-hidden rounded-[28px] transition-shadow focus-within:shadow-[0_0_0_4px_rgba(232,240,71,0.12)]">
            <input
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full border-b border-line bg-transparent px-5 py-4 text-[17px] text-ink placeholder:text-dim focus:outline-none"
            />
            <div className="relative">
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-transparent py-4 pl-5 pr-16 text-[17px] text-ink placeholder:text-dim focus:outline-none"
              />
              <motion.button
                type="submit"
                disabled={!canSubmit}
                whileTap={{ scale: 0.92 }}
                className={`absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full transition-all duration-300 ${
                  canSubmit
                    ? "bg-accent text-accent-ink shadow-[0_0_18px_2px_rgba(232,240,71,0.4)]"
                    : "border border-line-strong text-dim"
                }`}
                aria-label="Sign in"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <motion.span animate={{ x: canSubmit ? 0 : -2 }} transition={{ type: "spring", stiffness: 400, damping: 20 }} className="flex">
                    <ArrowRight className="h-5 w-5" strokeWidth={2.2} />
                  </motion.span>
                )}
              </motion.button>
            </div>
          </div>

          <AnimatePresence>
            {errorMsg && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-3 text-center text-[13px] text-danger"
              >
                {errorMsg}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.form>
        </motion.div>
      </div>
    </div>
  );
};

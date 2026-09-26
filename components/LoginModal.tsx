"use client";

import React, { useState } from "react";
import { signIn } from "@/lib/authClient";
import { ModalShell } from "./ui/ModalShell";
import { Button } from "./ui/Button";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (username: string, role: "admin" | "user") => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsLoading(true);

    try {
      const result = await signIn(username, password);
      if (result.success) {
        onLoginSuccess(result.username, result.role);
        onClose();
      } else {
        setErrorMsg(result.message);
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} className="max-w-sm">
      <form onSubmit={handleSubmit} className="p-6">
        <h3 className="mb-5 text-center text-xl font-semibold tracking-tight">Switch Account</h3>

        <div className="overflow-hidden rounded-xl border border-white/15 focus-within:border-accent focus-within:shadow-[0_0_0_4px_rgba(0,113,227,0.15)]">
          <input
            type="text"
            required
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="w-full border-b border-white/15 bg-transparent px-4 py-3 text-[15px] placeholder:text-dim focus:outline-none"
          />
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full bg-transparent px-4 py-3 text-[15px] placeholder:text-dim focus:outline-none"
          />
        </div>

        <p className="mt-2 h-5 text-center text-[13px] text-danger">{errorMsg}</p>

        <div className="mt-2 flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1 py-2.5 text-[15px]">
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} className="flex-1 py-2.5 text-[15px]">
            {isLoading ? "Signing In…" : "Sign In"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
};

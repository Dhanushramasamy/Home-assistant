"use client";

import React, { useState } from "react";
import { loginUser } from "@/lib/userStore";
import { ShieldCheck, User, KeyRound, AlertCircle, Cpu } from "lucide-react";

interface LoginPageProps {
  onLoginSuccess: (username: string, role: "admin" | "user") => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsLoading(true);

    try {
      const result = await loginUser(username, password);
      if (result.success) {
        onLoginSuccess(result.username, result.role);
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
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-slate-900 font-sans">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden">
        
        {/* Header */}
        <div className="flex flex-col items-center justify-center text-center p-8 border-b border-slate-100 bg-slate-50/50">
          <div className="w-14 h-14 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center border border-teal-200 mb-3 shadow-2xs">
            <Cpu className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Home Control</h2>
          <p className="text-xs text-slate-500 mt-1">Please sign in with your account to access devices</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-teal-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-teal-500 transition-colors"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm shadow-md active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <span>Signing in...</span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Sign In to Dashboard</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
      <p className="text-[11px] text-slate-400 mt-6">Home Control • Secure ESP32 & Pi Gateway Access</p>
    </div>
  );
};

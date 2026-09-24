"use client";

import React, { useState } from "react";
import { Sliders, ShieldCheck, UserPlus, CheckCircle2, AlertCircle } from "lucide-react";
import { createUserAccount } from "@/lib/userStore";

interface GeneralSettingsProps {
  currentUserRole?: "admin" | "user";
}

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({
  currentUserRole = "admin",
}) => {
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [userRole, setUserRole] = useState<"user" | "admin">("user");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setIsCreating(true);

    try {
      const result = await createUserAccount(newUsername, newPassword, userRole);
      if (result.success) {
        setMsg({ type: "success", text: result.message });
        setNewUsername("");
        setNewPassword("");
      } else {
        setMsg({ type: "error", text: result.message });
      }
    } catch (err) {
      setMsg({ type: "error", text: (err as Error).message });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      
      {/* General Card */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center space-x-3 border-b border-slate-100 pb-3">
          <div className="p-2.5 rounded-xl bg-teal-50 text-teal-600 border border-teal-200">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">General Options</h3>
            <p className="text-xs text-slate-500">System preferences and security parameters</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <h4 className="text-xs font-bold text-slate-800">Security Access Role</h4>
              <p className="text-[11px] text-slate-500">
                {currentUserRole === "admin" ? "Admin Mode (Full Settings Access)" : "Standard User (Simple View)"}
              </p>
            </div>
            <span className={`px-2.5 py-1 rounded-lg font-bold text-xs border ${
              currentUserRole === "admin"
                ? "bg-purple-100 text-purple-800 border-purple-200"
                : "bg-teal-100 text-teal-800 border-teal-200"
            }`}>
              {currentUserRole === "admin" ? "Admin" : "Standard User"}
            </span>
          </div>
        </div>
      </div>

      {/* Admin User Creation Card */}
      {currentUserRole === "admin" && (
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center space-x-3 border-b border-slate-100 pb-3">
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 border border-purple-200">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Create New User Account</h3>
              <p className="text-xs text-slate-500">Add accounts for family members or standard users</p>
            </div>
          </div>

          <form onSubmit={handleCreateUser} className="space-y-3">
            {msg && (
              <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center space-x-2 ${
                msg.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border-rose-200 text-rose-800"
              }`}>
                {msg.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{msg.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Username
                </label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Create password"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center space-x-3 text-xs text-slate-600">
                <label className="flex items-center space-x-1 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    checked={userRole === "user"}
                    onChange={() => setUserRole("user")}
                  />
                  <span>Standard User (Simple View)</span>
                </label>
                <label className="flex items-center space-x-1 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    checked={userRole === "admin"}
                    onChange={() => setUserRole("admin")}
                  />
                  <span>Admin</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isCreating || !newUsername.trim() || !newPassword.trim()}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-2xs active:scale-95 transition-all disabled:opacity-50"
              >
                {isCreating ? "Creating..." : "Create User"}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

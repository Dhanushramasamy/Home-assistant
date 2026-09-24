"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Device, NetworkConfig, PowerState, ToastMessage, TestConnectionResponse } from "@/types";
import { DeviceCard } from "@/components/DeviceCard";
import { AddDeviceModal } from "@/components/AddDeviceModal";
import { EditDeviceModal } from "@/components/EditDeviceModal";
import { ConnectionTestModal } from "@/components/ConnectionTestModal";
import { ToastContainer } from "@/components/ToastContainer";
import { SettingsView } from "@/components/settings/SettingsView";
import { LoginModal } from "@/components/LoginModal";
import { LoginPage } from "@/components/LoginPage";
import {
  Cpu,
  Plus,
  Settings,
  Home,
  RefreshCw,
  Search,
  X,
  Layers,
  Sparkles,
  Wifi,
  Server,
  Trash2,
  ShieldCheck,
  User,
  LogOut,
} from "lucide-react";

export default function HomeControlPage() {
  const [activeTab, setActiveTab] = useState<string>("All"); // "All" | roomName | "settings"
  const [devices, setDevices] = useState<Device[]>([]);
  const [networkConfig, setNetworkConfig] = useState<NetworkConfig | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showSearch, setShowSearch] = useState<boolean>(false);

  // User Auth Session State
  const [userSession, setUserSession] = useState<{ username: string; role: "admin" | "user" } | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedUser = localStorage.getItem("home_control_user");
      if (savedUser) {
        try {
          setUserSession(JSON.parse(savedUser));
        } catch {
          setUserSession(null);
        }
      } else {
        setUserSession(null);
      }
    }
  }, []);

  const handleLoginSuccess = (username: string, role: "admin" | "user") => {
    const session = { username, role };
    setUserSession(session);
    if (typeof window !== "undefined") {
      localStorage.setItem("home_control_user", JSON.stringify(session));
    }
    showToast("success", `Signed in as ${username}`, role === "admin" ? "Admin Access Granted" : "Standard User Access");
  };

  const handleLogout = () => {
    setUserSession(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("home_control_user");
    }
    setActiveTab("All");
    showToast("info", "Signed out successfully");
  };

  // Loading & Modal states
  const [isLoadingApp, setIsLoadingApp] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);

  // Connection test modal state
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResponse | null>(null);
  const [isTestLoading, setIsTestLoading] = useState(false);
  const [testingDeviceName, setTestingDeviceName] = useState("");

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback(
    (type: ToastMessage["type"], title: string, description?: string) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const newToast: ToastMessage = { id, type, title, description };
      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Sync devices state to localStorage whenever changed
  const updateDevicesState = useCallback(
    (newDevices: Device[] | ((prev: Device[]) => Device[])) => {
      setDevices((prev) => {
        const updated = typeof newDevices === "function" ? newDevices(prev) : newDevices;
        if (typeof window !== "undefined") {
          localStorage.setItem("home_control_devices", JSON.stringify(updated));
        }
        return updated;
      });
    },
    []
  );

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      const localDevicesStr = typeof window !== "undefined" ? localStorage.getItem("home_control_devices") : null;
      const localNetworkStr = typeof window !== "undefined" ? localStorage.getItem("home_control_network") : null;

      const [devicesRes, networkRes] = await Promise.all([
        fetch("/api/devices"),
        fetch("/api/network"),
      ]);

      if (devicesRes.ok) {
        const devicesData = await devicesRes.json();
        if (localDevicesStr && JSON.parse(localDevicesStr).length > 0 && devicesData.length === 0) {
          setDevices(JSON.parse(localDevicesStr));
        } else {
          setDevices(devicesData);
          if (typeof window !== "undefined") {
            localStorage.setItem("home_control_devices", JSON.stringify(devicesData));
          }
        }
      } else if (localDevicesStr) {
        setDevices(JSON.parse(localDevicesStr));
      }

      if (networkRes.ok) {
        const networkData = await networkRes.json();
        setNetworkConfig(networkData);
        if (typeof window !== "undefined") {
          localStorage.setItem("home_control_network", JSON.stringify(networkData));
        }
      } else if (localNetworkStr) {
        setNetworkConfig(JSON.parse(localNetworkStr));
      }
    } catch (err) {
      console.error("Failed to load home control data:", err);
      const localDevicesStr = typeof window !== "undefined" ? localStorage.getItem("home_control_devices") : null;
      if (localDevicesStr) {
        setDevices(JSON.parse(localDevicesStr));
      }
    } finally {
      setIsLoadingApp(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Unique room list
  const existingRooms = Array.from(new Set(devices.map((d) => d.room))).filter(Boolean);

  // Room Counts
  const roomCounts = devices.reduce<Record<string, number>>((acc, d) => {
    acc["All"] = (acc["All"] || 0) + 1;
    acc[d.room] = (acc[d.room] || 0) + 1;
    return acc;
  }, {});

  const onDevicesCount = devices.filter((d) => d.powerState === "on").length;

  // Instant Power Toggle (0ms Optimistic UI)
  const handleTogglePower = async (deviceId: string, currentPower: PowerState) => {
    const targetDevice = devices.find((d) => d.id === deviceId);
    if (!targetDevice) return;

    const nextState: PowerState = currentPower === "on" ? "off" : "on";

    updateDevicesState((prev) =>
      prev.map((d) =>
        d.id === deviceId
          ? { ...d, powerState: nextState, connectionState: "connected" }
          : d
      )
    );

    showToast("success", `✓ ${targetDevice.name} turned ${nextState.toUpperCase()}`);

    const effectiveMode = networkConfig?.mode === "gateway" || targetDevice.mode === "gateway" ? "gateway" : "direct";

    if (effectiveMode === "direct" && typeof window !== "undefined") {
      fetch(`http://${targetDevice.ip}/${nextState}`, {
        method: "GET",
        mode: "no-cors",
      }).catch(() => {});
    }

    fetch("/api/devices/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, action: nextState }),
    }).catch(() => {});
  };

  // Connection Test
  const handleTestConnection = async (deviceId: string) => {
    const target = devices.find((d) => d.id === deviceId);
    setTestingDeviceName(target?.name || "Device");
    setIsTestModalOpen(true);
    setIsTestLoading(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/devices/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({
        success: false,
        deviceId,
        deviceName: target?.name || "Device",
        ip: target?.ip || "0.0.0.0",
        mode: target?.mode || "direct",
        reachable: false,
        message: `✕ Could not probe device: ${(err as Error).message}`,
        targetUrl: target?.ip ? `http://${target.ip}/` : "N/A",
      });
    } finally {
      setIsTestLoading(false);
    }
  };

  // Add Device
  const handleSaveAddDevice = async (deviceData: {
    name: string;
    room: string;
    type: Device["type"];
    mode: Device["mode"];
    ip: string;
    relay: number;
  }) => {
    try {
      const res = await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deviceData),
      });

      if (res.ok) {
        const newDev = await res.json();
        updateDevicesState((prev) => [...prev, newDev]);
        showToast("success", "✓ Device added", `${newDev.name} registered`);
      } else {
        const fallbackDev: Device = {
          id: `dev-${Date.now()}`,
          name: deviceData.name,
          room: deviceData.room,
          type: deviceData.type,
          mode: deviceData.mode,
          ip: deviceData.ip,
          relay: deviceData.relay,
          powerState: "off",
          connectionState: "connected",
        };
        updateDevicesState((prev) => [...prev, fallbackDev]);
        showToast("success", "✓ Device added", `${fallbackDev.name} registered`);
      }
    } catch {
      const fallbackDev: Device = {
        id: `dev-${Date.now()}`,
        name: deviceData.name,
        room: deviceData.room,
        type: deviceData.type,
        mode: deviceData.mode,
        ip: deviceData.ip,
        relay: deviceData.relay,
        powerState: "off",
        connectionState: "connected",
      };
      updateDevicesState((prev) => [...prev, fallbackDev]);
      showToast("success", "✓ Device added", `${fallbackDev.name} registered`);
    }
  };

  // Edit Device
  const handleSaveEditDevice = async (id: string, updates: Partial<Device>) => {
    try {
      await fetch(`/api/devices/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
    } catch {}
    updateDevicesState((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));
    showToast("success", "✓ Device updated");
  };

  // Delete Device
  const handleDeleteDevice = async (device: Device) => {
    if (!window.confirm(`Delete '${device.name}'?`)) return;
    try {
      await fetch(`/api/devices/${device.id}`, { method: "DELETE" });
    } catch {}
    updateDevicesState((prev) => prev.filter((d) => d.id !== device.id));
    showToast("info", "✓ Device removed");
  };

  // Clear Mock Data
  const handleClearMockData = async () => {
    try {
      await fetch("/api/devices/clear", { method: "POST" });
    } catch {}
    updateDevicesState([]);
    showToast("info", "Cleared mock data");
  };

  // Reset Defaults
  const handleResetDefaults = async () => {
    try {
      const res = await fetch("/api/devices/reset", { method: "POST" });
      if (res.ok) {
        await fetchData();
      }
    } catch {}
  };

  // Filtered devices
  const filteredDevices = devices.filter((d) => {
    const matchesTab =
      activeTab === "All" ||
      activeTab === "settings" ||
      d.room.toLowerCase() === activeTab.toLowerCase();

    const matchesSearch =
      !searchQuery ||
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.room.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesTab && matchesSearch;
  });

  if (!userSession) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            
            {/* Title & Connection Dot */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center border border-teal-200">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900 leading-tight">
                  Home Control
                </h1>
                <p className="text-[10px] text-slate-500 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>{onDevicesCount} Active ON</span>
                  <span>•</span>
                  <span>{devices.length} Devices</span>
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center space-x-1.5">
              {/* User Account Button */}
              {userSession ? (
                <div className="flex items-center space-x-1 sm:space-x-1.5">
                  <button
                    onClick={() => setIsLoginModalOpen(true)}
                    className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1 rounded-xl text-xs font-semibold border transition-all ${
                      userSession.role === "admin"
                        ? "bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100"
                        : "bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100"
                    }`}
                    title="Click to Switch Account"
                  >
                    {userSession.role === "admin" ? (
                      <ShieldCheck className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    )}
                    <span className="font-bold">{userSession.username}</span>
                  </button>

                  <button
                    onClick={handleLogout}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-2xs transition-colors"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
              )}

              <button
                onClick={() => setShowSearch(!showSearch)}
                className={`p-1.5 sm:p-2 rounded-xl border transition-colors ${
                  showSearch ? "bg-teal-50 border-teal-300 text-teal-700" : "bg-slate-100 border-slate-200 text-slate-600"
                }`}
                title="Search Devices"
              >
                <Search className="w-4 h-4" />
              </button>

              {/* + Add Button only visible for Admin */}
              {userSession?.role === "admin" && (
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-2xs transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Add</span>
                </button>
              )}
            </div>

          </div>

          {/* Collapsible Search Drawer */}
          {showSearch && (
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center space-x-2 animate-in slide-in-from-top-1 duration-150">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type device name or room..."
                className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="p-1.5 text-slate-400 hover:text-slate-700 text-xs"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Minimal Tab Navigation Bar */}
          <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar pt-3 border-t border-slate-100 mt-2">
            
            {/* All Tab */}
            <button
              onClick={() => setActiveTab("All")}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                activeTab === "All"
                  ? "bg-teal-600 text-white border-teal-600 shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200/80"
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span>All</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${activeTab === "All" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"}`}>
                {devices.length}
              </span>
            </button>

            {/* Room Tabs */}
            {existingRooms.map((room) => {
              const isActive = activeTab === room;
              const count = roomCounts[room] || 0;
              return (
                <button
                  key={room}
                  onClick={() => setActiveTab(room)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                    isActive
                      ? "bg-teal-600 text-white border-teal-600 shadow-2xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200/80"
                  }`}
                >
                  <span>{room}</span>
                  <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${isActive ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"}`}>
                    {count}
                  </span>
                </button>
              );
            })}

            {/* Settings Tab (Only visible for Admin) */}
            {userSession?.role === "admin" && (
              <button
                onClick={() => setActiveTab("settings")}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ml-auto ${
                  activeTab === "settings"
                    ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200/80"
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Settings</span>
              </button>
            )}

          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-5">
        
        {isLoadingApp ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-2">
            <RefreshCw className="w-6 h-6 text-teal-600 animate-spin" />
            <p className="text-xs text-slate-500">Loading devices...</p>
          </div>
        ) : activeTab === "settings" && userSession?.role === "admin" ? (
          /* Settings View */
          <SettingsView
            devices={devices}
            networkConfig={networkConfig}
            currentUserRole={userSession.role}
            onSaveNetworkConfig={async (config) => {
              const res = await fetch("/api/network", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config),
              });
              if (res.ok) {
                const updated = await res.json();
                setNetworkConfig(updated);
              }
            }}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onEditDevice={(device) => setEditingDevice(device)}
            onDeleteDevice={handleDeleteDevice}
            onTestConnection={handleTestConnection}
            onResetDefaults={handleResetDefaults}
            onClearMockData={handleClearMockData}
            showToast={showToast}
          />
        ) : (
          /* Devices Grid View */
          <div className="space-y-4">
            
            {filteredDevices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl bg-white border border-slate-200 shadow-2xs">
                <Cpu className="w-10 h-10 text-slate-300 mb-3" />
                <h3 className="text-sm font-bold text-slate-800 mb-1">
                  {devices.length === 0 ? "No devices added yet" : "No devices found"}
                </h3>
                <p className="text-xs text-slate-500 max-w-xs mb-4">
                  {devices.length === 0
                    ? "Add your real ESP32 device IP address or load sample devices to test."
                    : `No devices found in tab '${activeTab}'.`}
                </p>

                <div className="flex items-center space-x-2">
                  {userSession?.role === "admin" && (
                    <button
                      onClick={() => setIsAddModalOpen(true)}
                      className="flex items-center space-x-1 px-3.5 py-2 rounded-xl bg-teal-600 text-white font-semibold text-xs shadow-2xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Real Device</span>
                    </button>
                  )}

                  {devices.length === 0 && (
                    <button
                      onClick={handleResetDefaults}
                      className="flex items-center space-x-1 px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>Load Sample Setup</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                {filteredDevices.map((device) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    onTogglePower={handleTogglePower}
                    onTestConnection={handleTestConnection}
                    onEditDevice={(device) => setEditingDevice(device)}
                    onDeleteDevice={handleDeleteDevice}
                    isActionLoading={false}
                  />
                ))}
              </div>
            )}

          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200/80 py-3 text-center text-[11px] text-slate-400 bg-white">
        Home Control • ESP32 Direct & Raspberry Pi Gateway Mode
      </footer>

      {/* Modals */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      <AddDeviceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSaveAddDevice}
        networkConfig={networkConfig}
        existingRooms={existingRooms}
      />

      <EditDeviceModal
        isOpen={!!editingDevice}
        device={editingDevice}
        onClose={() => setEditingDevice(null)}
        onSave={handleSaveEditDevice}
        networkConfig={networkConfig}
        existingRooms={existingRooms}
      />

      <ConnectionTestModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        result={testResult}
        isLoading={isTestLoading}
        deviceName={testingDeviceName}
      />

    </div>
  );
}

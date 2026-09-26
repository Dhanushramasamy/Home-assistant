"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Device, NetworkConfig, PowerState, ToastMessage, TestConnectionResponse, TimerAction } from "@/types";
import { fetchDeviceStatus, requestCancelTimer, requestClearTimers, requestStartTimer } from "@/lib/timerClient";
import { useBackClose } from "@/lib/useBackClose";
import type { EspStatusEntry } from "@/components/DeviceCard";
import { DeviceCard } from "@/components/DeviceCard";
import { AddDeviceModal } from "@/components/AddDeviceModal";
import { EditDeviceModal } from "@/components/EditDeviceModal";
import { ConnectionTestModal } from "@/components/ConnectionTestModal";
import { ToastContainer } from "@/components/ToastContainer";
import { SettingsView } from "@/components/settings/SettingsView";
import { LoginModal } from "@/components/LoginModal";
import { LoginPage } from "@/components/LoginPage";
import { Button } from "@/components/ui/Button";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Backdrop } from "@/components/ui/Backdrop";
import { easeApple, springs } from "@/lib/deviceTheme";
import { Plus, Settings, Search, X, House, User, LogOut } from "lucide-react";

export default function HomeControlPage() {
  const [activeTab, setActiveTab] = useState<string>("All"); // "All" | roomName | "settings"
  const [devices, setDevices] = useState<Device[]>([]);
  const [networkConfig, setNetworkConfig] = useState<NetworkConfig | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showSearch, setShowSearch] = useState<boolean>(false);

  // User Auth Session State
  // Session comes from the signed httpOnly cookie, checked by the server.
  const [userSession, setUserSession] = useState<{ username: string; role: "admin" | "user" } | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [showAccount, setShowAccount] = useState(false);


  useEffect(() => {
    // Old sessions were only a localStorage entry anyone could edit; drop it.
    try {
      localStorage.removeItem("home_control_user");
    } catch {}
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((me) => setUserSession(me?.authenticated ? { username: me.username, role: me.role } : null))
      .catch(() => setUserSession(null))
      .finally(() => setSessionChecked(true));
  }, []);

  const handleLoginSuccess = (username: string, role: "admin" | "user") => {
    setUserSession({ username, role });
  };

  const handleLogout = () => {
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUserSession(null);
    setDevices([]);
    try {
      localStorage.removeItem("home_control_devices");
      localStorage.removeItem("home_control_network");
    } catch {}
    setActiveTab("All");
  };

  // Android/browser back: close search, then leave Settings or a room filter
  // before exiting the app.
  useBackClose(activeTab === "settings", () => setActiveTab("All"));
  useBackClose(activeTab !== "All" && activeTab !== "settings", () => setActiveTab("All"));
  useBackClose(showSearch, () => setShowSearch(false));

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
      }, 2500);
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

      // Session expired or signed out elsewhere: back to the login screen.
      if (devicesRes.status === 401) {
        setUserSession(null);
        return;
      }

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
    if (userSession) fetchData();
  }, [fetchData, userSession]);

  // Unique room list
  const existingRooms = Array.from(new Set(devices.map((d) => d.room))).filter(Boolean);


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

    const effectiveMode = networkConfig?.mode === "gateway" || targetDevice.mode === "gateway" ? "gateway" : "direct";

    if (effectiveMode === "direct" && typeof window !== "undefined") {
      fetch(`http://${targetDevice.ip}/${nextState}?relay=${targetDevice.relay || 1}`, {
        method: "GET",
        mode: "no-cors",
      }).catch(() => {});
    }

    fetch("/api/devices/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, action: nextState }),
    })
      .catch(() => {})
      // Re-read the ESP32 so power + timers reflect what it actually did.
      // Manual ON/OFF never cancels timers.
      .finally(() => setTimeout(() => void refreshStatus(deviceId), 800));
  };

  // ESP32 status + timers. Each ESP32's /status is the source of truth for its
  // own power and timers; the DB only remembers what was scheduled.
  // Countdowns tick locally from `syncedAt` between syncs.
  const [espStatus, setEspStatus] = useState<Record<string, EspStatusEntry>>({});
  const devicesRef = useRef(devices);
  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  // Per-device sync schedule: online every 10 s, offline backs off 60 s -> 5 min.
  // Relays on the same ESP32 share one /status request on the server.
  const syncPlan = useRef<Record<string, { nextAt: number; failures: number }>>({});
  const ONLINE_SYNC_MS = 10_000;

  const refreshStatus = useCallback(
    async (deviceId: string) => {
      const device = devicesRef.current.find((d) => d.id === deviceId);
      if (!device) return;
      const status = await fetchDeviceStatus(device, networkConfig?.mode);

      const plan = syncPlan.current[deviceId] ?? { nextAt: 0, failures: 0 };
      plan.failures = status.reachable ? 0 : plan.failures + 1;
      plan.nextAt = Date.now() + (status.reachable ? ONLINE_SYNC_MS : Math.min(300_000, 60_000 * 2 ** (plan.failures - 1)));
      syncPlan.current[deviceId] = plan;

      setEspStatus((prev) => ({
        ...prev,
        [deviceId]: {
          reachable: status.reachable,
          // When offline, keep nothing as "running": we can't confirm it.
          timers: status.reachable ? status.timers ?? [] : [],
          timerCount: status.reachable ? status.timerCount : undefined,
          espDevice: status.espDevice ?? prev[deviceId]?.espDevice,
          rssi: status.reachable ? status.rssi : undefined,
          uptime: status.reachable ? status.uptime : undefined,
          ssid: status.reachable ? status.ssid : undefined,
          syncedAt: Date.now(),
        },
      }));
      setDevices((prev) =>
        prev.map((d) =>
          d.id === deviceId
            ? {
                ...d,
                ...(status.reachable
                  ? { powerState: status.power ?? d.powerState, connectionState: "connected" as const }
                  : { connectionState: "offline" as const }),
                ...(status.savedTimers ? { timers: status.savedTimers } : {}),
              }
            : d
        )
      );
    },
    [networkConfig?.mode]
  );

  // On load: contact every ESP32 independently, then follow each one's schedule.
  const deviceIdList = devices.map((d) => d.id).join(",");
  useEffect(() => {
    if (!deviceIdList) return;
    const tick = () => {
      const now = Date.now();
      for (const id of deviceIdList.split(",")) {
        const plan = syncPlan.current[id];
        if (!plan || now >= plan.nextAt) {
          syncPlan.current[id] = { nextAt: now + ONLINE_SYNC_MS, failures: plan?.failures ?? 0 };
          void refreshStatus(id);
        }
      }
    };
    const first = setTimeout(tick, 300);
    const interval = setInterval(tick, 5_000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [deviceIdList, refreshStatus]);

  const handleStartTimer = async (deviceId: string, action: TimerAction, seconds: number, repeat: boolean) => {
    const device = devices.find((d) => d.id === deviceId);
    if (!device) return;
    const result = await requestStartTimer(device, networkConfig?.mode, { action, seconds, repeat });
    if (!result.success) showToast("error", result.message);
    await refreshStatus(deviceId);
  };

  const handleCancelTimer = async (deviceId: string, timerId: number) => {
    const device = devices.find((d) => d.id === deviceId);
    if (!device) return;
    const result = await requestCancelTimer(device, networkConfig?.mode, timerId);
    if (!result.success && result.reason !== "not_found") showToast("error", result.message);
    await refreshStatus(deviceId);
  };

  const handleClearTimers = async (deviceId: string) => {
    const device = devices.find((d) => d.id === deviceId);
    if (!device) return;
    if (!window.confirm(`Cancel all timers on '${device.name}'?`)) return;
    const result = await requestClearTimers(device, networkConfig?.mode);
    if (!result.success) showToast("error", result.message);
    await refreshStatus(deviceId);
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
        showToast("success", "Device Added");
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
        showToast("success", "Device Added");
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
      showToast("success", "Device Added");
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
    showToast("success", "Saved");
  };

  // Delete Device
  const handleDeleteDevice = async (device: Device) => {
    if (!window.confirm(`Delete '${device.name}'?`)) return;
    try {
      await fetch(`/api/devices/${device.id}`, { method: "DELETE" });
    } catch {}
    updateDevicesState((prev) => prev.filter((d) => d.id !== device.id));
    showToast("info", "Device Removed");
  };

  // Clear Mock Data
  const handleClearMockData = async () => {
    try {
      await fetch("/api/devices/clear", { method: "POST" });
    } catch {}
    updateDevicesState([]);
    showToast("info", "Sample Data Cleared");
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

  // Wait for the server to confirm the session before showing anything.
  if (!sessionChecked) {
    return <Backdrop />;
  }

  if (!userSession) {
    return (
      <>
        <LoginPage onLoginSuccess={handleLoginSuccess} />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  const isAdmin = userSession.role === "admin";
  const isSettings = activeTab === "settings" && isAdmin;
  const tabs = [
    { id: "All", label: "All" },
    ...existingRooms.map((room) => ({ id: room, label: room })),
  ];
  const navItems = [
    { id: "home", label: "Home", icon: House, active: !isSettings, action: () => setActiveTab("All") },
    ...(isAdmin
      ? [{ id: "settings", label: "Settings", icon: Settings, active: isSettings, action: () => setActiveTab("settings") }]
      : []),
  ];
  const circleBtn = "glass-btn flex h-[52px] w-[52px] items-center justify-center rounded-full text-ink";
  const rise = (i: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: easeApple, delay: i * 0.07 },
  });

  return (
    <MotionConfig reducedMotion="user">
    <div className="relative flex min-h-screen flex-col text-ink">
      <Backdrop />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-36 pt-6 sm:px-8 sm:pt-10">
        {/* Top row: avatar + actions */}
        <motion.div {...rise(0)} className="flex items-center justify-between">
          <div className="relative">
            <button
              onClick={() => setShowAccount(!showAccount)}
              className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-gradient-to-br from-[#f4f8a0] to-[#c9d23a] text-[20px] font-semibold uppercase text-[#151515] ring-2 ring-white/10 transition-transform active:scale-90"
              aria-label="Account"
            >
              {userSession.username.charAt(0)}
            </button>
            <AnimatePresence>
              {showAccount && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowAccount(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94 }}
                    transition={{ duration: 0.18, ease: easeApple }}
                    style={{ transformOrigin: "top left" }}
                    className="absolute left-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#26272c]/95 py-1 text-[14px] shadow-2xl backdrop-blur-xl"
                  >
                    <div className="px-4 py-2.5">
                      <p className="text-[16px] font-medium capitalize">{userSession.username}</p>
                      <p className="text-muted">{isAdmin ? "Administrator" : "Member"}</p>
                    </div>
                    <div className="my-1 h-px bg-line" />
                    <button
                      onClick={() => {
                        setShowAccount(false);
                        setIsLoginModalOpen(true);
                      }}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-white/[0.06]"
                    >
                      Switch Account
                      <User className="h-4 w-4 opacity-70" />
                    </button>
                    <button
                      onClick={() => {
                        setShowAccount(false);
                        handleLogout();
                      }}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left text-danger hover:bg-white/[0.06]"
                    >
                      Sign Out
                      <LogOut className="h-4 w-4" />
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-2">
            {!isSettings && (
              <button onClick={() => setShowSearch(!showSearch)} className={circleBtn} aria-label="Search">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={showSearch ? "x" : "s"}
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex"
                  >
                    {showSearch ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
                  </motion.span>
                </AnimatePresence>
              </button>
            )}
            {isAdmin && (
              <button onClick={() => setIsAddModalOpen(true)} className={circleBtn} aria-label="Add device">
                <Plus className="h-6 w-6" />
              </button>
            )}
          </div>
        </motion.div>

        {/* Greeting */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.h1
            key={isSettings ? "settings" : "home"}
            initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(6px)" }}
            transition={{ duration: 0.5, ease: easeApple, delay: 0.05 }}
            className="mb-7 mt-8 text-[40px] font-medium leading-[1.1] tracking-tight sm:text-[52px]"
          >
            {isSettings ? (
              "Settings"
            ) : (
              <>
                Hi <span className="capitalize">{userSession.username}</span>!
                <br />
                Welcome Home
              </>
            )}
          </motion.h1>
        </AnimatePresence>

        {isLoadingApp ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-[210px] rounded-[28px]" />
            ))}
          </div>
        ) : isSettings ? (
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
            username={userSession.username}
            onSwitchAccount={() => setIsLoginModalOpen(true)}
            onSignOut={handleLogout}
          />
        ) : (
          <>
            {/* Search */}
            <AnimatePresence initial={false}>
              {showSearch && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: easeApple }}
                  className="overflow-hidden"
                >
                  <div className="relative mb-4">
                    <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-dim" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search devices"
                      className="glass h-[52px] w-full rounded-full pl-13 pr-5 text-[16px] text-ink placeholder:text-dim focus:outline-none"
                      autoFocus
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Rooms */}
            <motion.nav {...rise(2)} className="no-scrollbar -mx-5 mb-5 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:px-0">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative h-[52px] shrink-0 whitespace-nowrap rounded-full px-6 text-[16px] transition-colors active:scale-95 ${
                      isActive ? "text-[#151515]" : "glass-btn text-ink/85"
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="room-tab"
                        transition={springs.snappy}
                        className="absolute inset-0 rounded-full bg-white shadow-[0_6px_20px_-6px_rgba(255,255,255,0.35)]"
                      />
                    )}
                    <span className="relative">{tab.label}</span>
                  </button>
                );
              })}
            </motion.nav>

            {filteredDevices.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="glass flex flex-col items-center rounded-[28px] px-6 py-16 text-center"
              >
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="glass-btn mb-5 flex h-16 w-16 items-center justify-center rounded-full"
                >
                  <House className="h-7 w-7 text-accent" strokeWidth={1.8} />
                </motion.div>
                <h3 className="text-[20px] font-medium">{devices.length === 0 ? "No Devices" : "No Results"}</h3>
                {devices.length === 0 && (
                  <div className="mt-6 flex gap-2">
                    {isAdmin && (
                      <Button onClick={() => setIsAddModalOpen(true)} className="px-6 py-3 text-[15px]">
                        Add Device
                      </Button>
                    )}
                    <Button variant="secondary" onClick={handleResetDefaults} className="px-6 py-3 text-[15px]">
                      Load Sample
                    </Button>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div layout className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                <AnimatePresence mode="popLayout">
                  {filteredDevices.map((device, i) => (
                    <DeviceCard
                      key={device.id}
                      index={i}
                      device={device}
                      onTogglePower={handleTogglePower}
                      onTestConnection={handleTestConnection}
                      onEditDevice={(device) => setEditingDevice(device)}
                      onDeleteDevice={handleDeleteDevice}
                      isActionLoading={false}
                      espStatus={espStatus[device.id]}
                      onRefreshStatus={refreshStatus}
                      onStartTimer={handleStartTimer}
                      onCancelTimer={handleCancelTimer}
                      onClearTimers={handleClearTimers}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </>
        )}
      </main>

      {/* Floating bottom nav (hidden when there is only one destination) */}
      {navItems.length > 1 && (
      <motion.nav
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 26, delay: 0.3 }}
        className="glass fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full p-2"
      >
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={item.action}
            className="relative flex h-14 w-14 items-center justify-center rounded-full transition-transform active:scale-90"
            aria-label={item.label}
          >
            {item.active && (
              <motion.span
                layoutId="nav-pill"
                transition={springs.snappy}
                className="absolute inset-0 rounded-full bg-white shadow-[0_4px_18px_-4px_rgba(255,255,255,0.4)]"
              />
            )}
            <item.icon className={`relative h-6 w-6 ${item.active ? "text-[#151515]" : "text-ink"}`} strokeWidth={1.8} />
          </button>
        ))}
      </motion.nav>
      )}

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
    </MotionConfig>
  );
}

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Device, NetworkConfig, PowerState, ToastMessage, TestConnectionResponse } from "@/types";
import { Header } from "@/components/Header";
import { SummaryCards } from "@/components/SummaryCards";
import { RoomFilter } from "@/components/RoomFilter";
import { SearchBar } from "@/components/SearchBar";
import { DeviceGrid } from "@/components/DeviceGrid";
import { AddDeviceModal } from "@/components/AddDeviceModal";
import { EditDeviceModal } from "@/components/EditDeviceModal";
import { ConnectionTestModal } from "@/components/ConnectionTestModal";
import { ToastContainer } from "@/components/ToastContainer";
import { SettingsView } from "@/components/settings/SettingsView";
import { RefreshCw } from "lucide-react";

export default function HomeControlPage() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "settings">("dashboard");
  const [devices, setDevices] = useState<Device[]>([]);
  const [networkConfig, setNetworkConfig] = useState<NetworkConfig | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Loading & Modal states
  const [isLoadingApp, setIsLoadingApp] = useState(true);
  const [loadingDeviceIds, setLoadingDeviceIds] = useState<Set<string>>(new Set());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  
  // Test connection modal state
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
      }, 4500);
    },
    []
  );

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Fetch initial data & sync with localStorage for Vercel deployment
  const fetchData = useCallback(async () => {
    try {
      // Check localStorage first for Vercel deployment persistence
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
  }, [showToast]);

  // Sync devices state to localStorage whenever changed
  const updateDevicesState = useCallback((newDevices: Device[] | ((prev: Device[]) => Device[])) => {
    setDevices((prev) => {
      const updated = typeof newDevices === "function" ? newDevices(prev) : newDevices;
      if (typeof window !== "undefined") {
        localStorage.setItem("home_control_devices", JSON.stringify(updated));
      }
      return updated;
    });
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Extract unique room names
  const existingRooms = Array.from(new Set(devices.map((d) => d.room))).filter(Boolean);

  // Compute room counts for filter bar
  const roomCounts = devices.reduce<Record<string, number>>((acc, d) => {
    acc["All"] = (acc["All"] || 0) + 1;
    acc[d.room] = (acc[d.room] || 0) + 1;
    return acc;
  }, {});

  // Handle Power Toggle
  const handleTogglePower = async (deviceId: string, currentPower: PowerState) => {
    const targetDevice = devices.find((d) => d.id === deviceId);
    if (!targetDevice) return;

    const nextState: PowerState = currentPower === "on" ? "off" : "on";

    setLoadingDeviceIds((prev) => new Set(prev).add(deviceId));

    try {
      const res = await fetch("/api/devices/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId,
          action: nextState,
        }),
      });

      const data = await res.json();

      if (data.success) {
        updateDevicesState((prev) =>
          prev.map((d) =>
            d.id === deviceId
              ? {
                  ...d,
                  powerState: data.powerState,
                  connectionState: data.connectionState,
                }
              : d
          )
        );

        showToast(
          "success",
          `✓ ${targetDevice.name} turned ${data.powerState.toUpperCase()}`,
          data.message
        );
      } else {
        showToast(
          "error",
          `✕ ${targetDevice.name} could not be reached`,
          data.message || "Failed to communicate with device endpoint."
        );
      }
    } catch (err) {
      showToast(
        "error",
        `✕ Error controlling ${targetDevice.name}`,
        (err as Error).message
      );
    } finally {
      setLoadingDeviceIds((prev) => {
        const next = new Set(prev);
        next.delete(deviceId);
        return next;
      });
    }
  };

  // Handle Connection Test
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
        message: `✕ Failed to probe device: ${(err as Error).message}`,
        targetUrl: target?.ip ? `http://${target.ip}/` : "N/A",
      });
    } finally {
      setIsTestLoading(false);
    }
  };

  // Add Device Handler
  const handleSaveAddDevice = async (deviceData: {
    name: string;
    room: string;
    type: Device["type"];
    mode: Device["mode"];
    ip: string;
    relay: number;
  }) => {
    const res = await fetch("/api/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(deviceData),
    });

    if (res.ok) {
      const newDev = await res.json();
      updateDevicesState((prev) => [...prev, newDev]);
      showToast("success", "✓ Device saved", `${newDev.name} registered on ${newDev.ip}`);
    } else {
      // Fallback for Vercel serverless environment if API fails
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
        lastSeen: new Date().toISOString(),
      };
      updateDevicesState((prev) => [...prev, fallbackDev]);
      showToast("success", "✓ Device saved", `${fallbackDev.name} registered on ${fallbackDev.ip}`);
    }
  };

  // Edit Device Handler
  const handleSaveEditDevice = async (id: string, updates: Partial<Device>) => {
    try {
      const res = await fetch(`/api/devices/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        const updated = await res.json();
        updateDevicesState((prev) => prev.map((d) => (d.id === id ? updated : d)));
      } else {
        updateDevicesState((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));
      }
      showToast("success", "✓ Device updated", "Saved configuration");
    } catch {
      updateDevicesState((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));
      showToast("success", "✓ Device updated", "Saved configuration");
    }
  };

  // Delete Device Handler
  const handleDeleteDevice = async (device: Device) => {
    if (!window.confirm(`Are you sure you want to delete '${device.name}'?`)) return;

    try {
      await fetch(`/api/devices/${device.id}`, { method: "DELETE" });
    } catch (err) {
      console.error(err);
    }
    updateDevicesState((prev) => prev.filter((d) => d.id !== device.id));
    showToast("info", "✓ Device deleted", `Removed ${device.name}`);
  };

  // Clear Mock Data Handler
  const handleClearMockData = async () => {
    try {
      await fetch("/api/devices/clear", { method: "POST" });
    } catch (err) {
      console.error(err);
    }
    updateDevicesState([]);
    showToast("info", "Cleared Mock Data", "All sample devices removed. Ready for your real devices.");
  };

  // Save Network Config Handler
  const handleSaveNetworkConfig = async (config: Partial<NetworkConfig>) => {
    const res = await fetch("/api/network", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });

    if (res.ok) {
      const updated = await res.json();
      setNetworkConfig(updated);
    } else {
      const err = await res.json();
      throw new Error(err.error || "Failed to update network config");
    }
  };

  // Reset Defaults Handler
  const handleResetDefaults = async () => {
    const res = await fetch("/api/devices/reset", { method: "POST" });
    if (res.ok) {
      await fetchData();
    } else {
      throw new Error("Reset endpoint failed");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      
      {/* Toasts */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        networkConfig={networkConfig}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onClearMockData={handleClearMockData}
        hasDevices={devices.length > 0}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {isLoadingApp ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <RefreshCw className="w-8 h-8 text-teal-600 animate-spin" />
            <p className="text-sm font-medium text-slate-600">
              Loading Home Control...
            </p>
          </div>
        ) : activeTab === "dashboard" ? (
          <div className="space-y-6">
            
            {/* Header Title Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
                  <span>Dashboard</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manage your home lights, fans, and relays
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <SearchBar
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                />
              </div>
            </div>

            {/* Summary Statistics */}
            <SummaryCards devices={devices} networkConfig={networkConfig} />

            {/* Room Filters */}
            <RoomFilter
              rooms={existingRooms}
              selectedRoom={selectedRoom}
              onSelectRoom={setSelectedRoom}
              roomCounts={roomCounts}
            />

            {/* Main Device Cards Grid */}
            <DeviceGrid
              devices={devices}
              selectedRoom={selectedRoom}
              searchQuery={searchQuery}
              onTogglePower={handleTogglePower}
              onTestConnection={handleTestConnection}
              onEditDevice={(device) => setEditingDevice(device)}
              onDeleteDevice={handleDeleteDevice}
              onOpenAddModal={() => setIsAddModalOpen(true)}
              onLoadSampleData={handleResetDefaults}
              loadingDeviceIds={loadingDeviceIds}
            />

          </div>
        ) : (
          /* Settings View */
          <SettingsView
            devices={devices}
            networkConfig={networkConfig}
            onSaveNetworkConfig={handleSaveNetworkConfig}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onEditDevice={(device) => setEditingDevice(device)}
            onDeleteDevice={handleDeleteDevice}
            onTestConnection={handleTestConnection}
            onResetDefaults={handleResetDefaults}
            onClearMockData={handleClearMockData}
            showToast={showToast}
          />
        )}

      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white/50">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>Home Control • ESP32 & Raspberry Pi 5 Gateway System</p>
          <p className="text-slate-400">Technical IP details configured in Settings</p>
        </div>
      </footer>

      {/* Modals */}
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

"use client";

import React, { useEffect, useState } from "react";
import { usePopupMessage } from "@/components/PopupMessage";
import Sidebar from "../Navbars/navbar";

type HotelSettings = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  currency: string;
};

export default function SettingsDash() {
  const { notify } = usePopupMessage();
  const [settings, setSettings] = useState<HotelSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/v1/hotel")
      .then((res) => res.json())
      .then((data) => setSettings(data))
      .finally(() => setLoading(false));
  }, []);

  function updateField(field: keyof HotelSettings, value: string) {
    setSettings((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/hotel", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          data?.message || data?.error || "Unable to save hotel settings.",
        );
      }

      notify({
        kind: "success",
        title: "Hotel settings saved",
      });
    } catch (error) {
      notify({
        kind: "error",
        title: "Hotel settings could not be saved",
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen w-full bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center text-gray-500">
          Loading settings...
        </main>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex h-screen w-full bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center text-red-500">
          Could not load hotel settings.
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#F5F0E4]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto px-10 py-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">
          Hotel Settings
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          General information and preferences
        </p>

        <div className="bg-white rounded-md border border-gray-200 p-6 mb-6 max-w-2xl">
          <h2 className="font-semibold text-gray-900 mb-4">Hotel profile</h2>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            HOTEL NAME
          </label>
          <input
            className="w-full border border-gray-300 rounded px-3 py-2 mb-4 text-sm"
            value={settings.name || ""}
            onChange={(e) => updateField("name", e.target.value)}
          />
          <label className="block text-xs font-medium text-gray-500 mb-1">
            ADDRESS
          </label>
          <input
            className="w-full border border-gray-300 rounded px-3 py-2 mb-4 text-sm"
            value={settings.address || ""}
            onChange={(e) => updateField("address", e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Phone number
              </label>
              <input
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                value={settings.phone || ""}
                onChange={(e) => updateField("phone", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Email
              </label>
              <input
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                value={settings.email || ""}
                onChange={(e) => updateField("email", e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-md border border-gray-200 p-6 mb-6 max-w-2xl">
          <h2 className="font-semibold text-gray-900 mb-4">
            Operational preferences
          </h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Check-in Time
              </label>
              <input
                type="time"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                value={settings.checkInTime || ""}
                onChange={(e) => updateField("checkInTime", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Check-out Time
              </label>
              <input
                type="time"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                value={settings.checkOutTime || ""}
                onChange={(e) => updateField("checkOutTime", e.target.value)}
              />
            </div>
          </div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Currency
          </label>
          <select
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            value={settings.currency || "USD"}
            onChange={(e) => updateField("currency", e.target.value)}
          >
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="LBP">LBP (ل.ل)</option>
          </select>
        </div>

        <div className="flex items-center gap-3 max-w-2xl">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#C1633B] text-white text-sm font-medium px-5 py-2 rounded disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </main>
    </div>
  );
}

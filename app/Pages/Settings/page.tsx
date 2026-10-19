"use client";

import { useEffect, useState } from "react";
import { usePopupMessage } from "@/components/PopupMessage";
import styles from "./page.module.css";
import Header from "@/components/Header/Header";
import { useAuth } from "@/components/Auth/AuthProvider";

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

const CURRENCIES = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "LBP", label: "LBP (ل.ل)" },
];

export default function HotelSettingsPage() {
  const { notify } = usePopupMessage();
  const { setHotelCurrency } = useAuth();
  const [settings, setSettings] = useState<HotelSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const res = await fetch("/api/v1/hotel", { signal: controller.signal });
        const data = await res.json();
        if (!res.ok) {
          setLoadError(data.error ?? "Could not load hotel settings.");
          return;
        }
        setSettings(data);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setLoadError("Could not load hotel settings.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, []);

  function updateField(field: keyof HotelSettings, value: string) {
    setSettings((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);

    try {
      // `id` is the primary key — never send it as an editable field.
      const { id: _id, ...payload } = settings;
      const res = await fetch("/api/v1/hotel", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        notify({ kind: "success", title: "Hotel settings saved" });
        setHotelCurrency(settings.currency);
        setSaved(true);
      } else {
        const data = await res.json().catch(() => ({}));
        notify({
          kind: "error",
          title: "Settings were not saved",
          description: data.error ?? "Could not save changes.",
        });
      }
    } catch {
      notify({
        kind: "error",
        title: "Settings were not saved",
        description: "Something went wrong saving your changes.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className={styles.stateScreen}>Loading settings…</main>;
  }

  if (!settings) {
    return (
      <main
        className={`${styles.stateScreen} ${styles.stateScreenError}`}
        role="alert"
      >
        {loadError ?? "Could not load hotel settings."}
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <Header
        title="Hotel Settings"
        subtitle="Manage your hotel information and preferences"
        userSubtitle="Currently managing hotel settings"
      />
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Hotel profile</h2>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="hotel-name">
            Hotel name
          </label>
          <input
            id="hotel-name"
            className={styles.input}
            value={settings.name || ""}
            onChange={(e) => updateField("name", e.target.value)}
            maxLength={30}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="hotel-address">
            Address
          </label>
          <input
            id="hotel-address"
            className={styles.input}
            value={settings.address || ""}
            onChange={(e) => updateField("address", e.target.value)}
            maxLength={200}
          />
        </div>

        <div className={styles.grid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="hotel-phone">
              Phone number
            </label>
            <input
              id="hotel-phone"
              type="tel"
              className={styles.input}
              value={settings.phone || ""}
              onChange={(e) => updateField("phone", e.target.value)}
              maxLength={20}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="hotel-email">
              Email
            </label>
            <input
              id="hotel-email"
              type="email"
              className={styles.input}
              value={settings.email || ""}
              onChange={(e) => updateField("email", e.target.value)}
              maxLength={40}
            />
          </div>
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Operational preferences</h2>

        <div className={styles.grid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="check-in">
              Check-in time
            </label>
            <input
              id="check-in"
              type="time"
              className={styles.input}
              value={settings.checkInTime || ""}
              onChange={(e) => updateField("checkInTime", e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="check-out">
              Check-out time
            </label>
            <input
              id="check-out"
              type="time"
              className={styles.input}
              value={settings.checkOutTime || ""}
              onChange={(e) => updateField("checkOutTime", e.target.value)}
            />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="currency">
            Currency
          </label>
          <select
            id="currency"
            className={styles.selectInput}
            value={settings.currency || "USD"}
            onChange={(e) => updateField("currency", e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <div className={styles.actions}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className={styles.saveButton}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </main>
  );
}

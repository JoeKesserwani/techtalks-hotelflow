"use client";
import { useState } from "react";

export default function EnablePush() {
  const [enabled, setEnabled] = useState(false);

  async function enableNotifications() {
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setEnabled(true);
        alert("Notifications enabled");
      } else {
        alert("Notifications denied");
      }
    } catch (err) {
      console.error("Error enabling notifications:", err);
    }
  }

  return (
    <button onClick={enableNotifications}>
      {enabled ? "Notifications enabled" : "Enable notifications"}
    </button>
  );
}

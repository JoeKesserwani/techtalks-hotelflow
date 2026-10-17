"use client";
import { useState } from "react";
import { usePopupMessage } from "@/components/PopupMessage";

export default function EnablePush() {
  const { notify } = usePopupMessage();
  const [enabled, setEnabled] = useState(false);

  async function enableNotifications() {
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setEnabled(true);
        notify({ kind: "success", title: "Notifications enabled" });
      } else {
        notify({
          kind: "warning",
          title: "Notifications not enabled",
          description:
            "Grant notification permission in your browser settings to enable alerts.",
        });
      }
    } catch (err) {
      console.error("Error enabling notifications:", err);
      notify({
        kind: "error",
        title: "Could not enable notifications",
        description:
          "Please try again or check your browser's notification settings.",
      });
    }
  }

  return (
    <button type="button" onClick={enableNotifications}>
      {enabled ? "Notifications enabled" : "Enable notifications"}
    </button>
  );
}

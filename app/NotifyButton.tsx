"use client";

import { useEffect, useState } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0))).buffer;
}

type Status = "idle" | "checking" | "subscribed" | "unsupported" | "denied" | "error";

export default function NotifyButton() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    async function check() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      const existing = await reg.pushManager.getSubscription();
      setStatus(existing ? "subscribed" : "idle");
    }
    check().catch(() => setStatus("error"));
  }, []);

  async function subscribe() {
    if (!VAPID_PUBLIC_KEY) {
      setStatus("error");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setStatus("denied");
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });
    setStatus("subscribed");
  }

  async function unsubscribe() {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();
    if (subscription) {
      await fetch("/api/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      await subscription.unsubscribe();
    }
    setStatus("idle");
  }

  if (status === "unsupported") {
    return (
      <div>
        <button className="notify-button" disabled>
          Notifications not supported on this browser
        </button>
        <div className="status-line">Try Chrome on Android or desktop — iOS Safari support is limited.</div>
      </div>
    );
  }

  if (status === "checking") {
    return (
      <button className="notify-button" disabled>
        Checking…
      </button>
    );
  }

  if (status === "subscribed") {
    return (
      <div>
        <button className="notify-button subscribed" onClick={unsubscribe}>
          ✓ You'll be notified — tap to turn off
        </button>
      </div>
    );
  }

  return (
    <div>
      <button className="notify-button" onClick={subscribe}>
        🔔 Notify me for the next session
      </button>
      {status === "denied" && (
        <div className="status-line">Notifications are blocked — enable them in your browser settings.</div>
      )}
      {status === "error" && <div className="status-line">Something went wrong. Try again in a bit.</div>}
    </div>
  );
}

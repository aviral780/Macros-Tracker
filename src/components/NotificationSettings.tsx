"use client";

import { useState, useSyncExternalStore } from "react";
import { api, useData } from "@/lib/client";
import { Icon } from "./Icon";
import { useToast } from "./Toast";

type Status = { devices: number; configured: boolean; publicKey: string };

/** base64url → Uint8Array, the format PushManager wants for the VAPID key. */
function decodeKey(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function NotificationSettings() {
  const toast = useToast();
  const { data, reload } = useData<Status>("/api/push/subscribe");
  const [busy, setBusy] = useState(false);
  const [granted, setGranted] = useState<NotificationPermission | null>(null);

  // Read through a store rather than an effect so the server and first client render
  // agree, and no state is set synchronously during rendering.
  const environment = useSyncExternalStore(subscribeNothing, clientEnvironment, serverEnvironment);
  const [supported, installed, reportedPermission] = environment.split("|");
  const permission = (granted ?? reportedPermission) as NotificationPermission | "unsupported";
  const standalone = installed === "true";

  const enable = async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const decision = await Notification.requestPermission();
      setGranted(decision);
      if (decision !== "granted") throw new Error("Notifications were not allowed for this app");

      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeKey(data!.publicKey),
        }));

      await api("/api/push/subscribe", { method: "POST", body: subscription.toJSON() });
      await reload();
      toast("Notifications are on for this device");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't turn on notifications", { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await api("/api/push/subscribe", { method: "DELETE", body: { endpoint: subscription.endpoint } });
        await subscription.unsubscribe();
      }
      await reload();
      toast("Notifications off for this device");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't turn them off", { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      const r = await api<{ sent: number; reason?: string }>("/api/push/send?slot=now", { method: "POST" });
      toast(r.sent > 0 ? `Sent to ${r.sent} device${r.sent === 1 ? "" : "s"}` : r.reason ?? "Nothing to send to", {
        tone: r.sent > 0 ? "default" : "error",
      });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't send", { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <section className="panel h-40 animate-pulse" />;
  if (supported !== "true") {
    return (
      <section className="panel p-5">
        <h2 className="semi-condensed text-[20px] font-bold">Meal reminders</h2>
        <p className="mt-2 text-[14px] text-ink-2">
          This browser can&apos;t do web push. On iPhone, open the app from its Home Screen icon.
        </p>
      </section>
    );
  }

  return (
    <section className="panel p-5">
      <h2 className="semi-condensed text-[20px] font-bold">Meal reminders</h2>
      <p className="mt-1 text-[14px] text-ink-2">
        Push notifications at breakfast, lunch and dinner, plus a nudge when a session is due. The text comes from your
        actual day, not a generic reminder.
      </p>

      {!data.configured ? (
        <p className="mt-4 rounded-xl bg-panel-2 p-3.5 text-[13px] leading-relaxed text-ink-2">
          Push isn&apos;t set up on the server yet. Generate a VAPID key pair and set{" "}
          <code className="rounded bg-panel px-1.5 py-0.5 font-mono text-ink">VAPID_PUBLIC_KEY</code> and{" "}
          <code className="rounded bg-panel px-1.5 py-0.5 font-mono text-ink">VAPID_PRIVATE_KEY</code>, then redeploy.
        </p>
      ) : (
        <>
          {!standalone && (
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-panel-2 p-3.5 text-[13px] leading-relaxed text-ink-2">
              <Icon name="alert" size={15} className="mt-0.5 shrink-0 text-fat" />
              On iPhone, notifications only work once the app is installed. Tap Share, then{" "}
              <strong className="font-semibold text-ink">Add to Home Screen</strong>, and open it from that icon before
              turning these on.
            </p>
          )}

          <dl className="mt-4 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-panel-2 py-2.5">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Devices</dt>
              <dd className="text-[18px] font-bold tnum">{data.devices}</dd>
            </div>
            <div className="rounded-lg bg-panel-2 py-2.5">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Permission</dt>
              <dd className="text-[18px] font-bold capitalize">{permission}</dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={busy} onClick={enable}>
              <Icon name="check" size={16} />
              Turn on for this device
            </button>
            <button className="btn btn-ghost" disabled={busy || data.devices === 0} onClick={test}>
              Send a test
            </button>
            <button className="btn btn-quiet" disabled={busy || data.devices === 0} onClick={disable}>
              Turn off
            </button>
          </div>
        </>
      )}
    </section>
  );
}

const subscribeNothing = () => () => {};

/** Stable "supported|installed|permission" string, so re-renders compare equal. */
function clientEnvironment() {
  const supported = "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
  // iOS only grants push to a Home Screen install, so detect that to explain failures.
  const installed =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true ||
    !/iphone|ipad|ipod/i.test(navigator.userAgent);
  return `${supported}|${installed}|${supported ? Notification.permission : "unsupported"}`;
}

const serverEnvironment = () => "true|true|default";

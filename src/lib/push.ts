import "server-only";
import webpush from "web-push";
import { all, run } from "./db";
import { nudge, snapshot } from "./nudge";

export type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

/**
 * VAPID wants a contact URL, not a bare address, and pasting a plain email is the
 * easy mistake — web-push then rejects every send with "not a valid URL".
 */
function vapidSubject() {
  const raw = (process.env.VAPID_SUBJECT ?? "").trim();
  if (!raw) return "mailto:macros@example.com";
  if (/^(mailto:|https?:\/\/)/i.test(raw)) return raw;
  return raw.includes("@") ? `mailto:${raw}` : `https://${raw}`;
}

function configured() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(vapidSubject(), publicKey, privateKey);
  return true;
}

export async function saveSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  await run(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth) VALUES (?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth`,
    [sub.endpoint, sub.keys.p256dh, sub.keys.auth],
  );
}

export const removeSubscription = (endpoint: string) =>
  run("DELETE FROM push_subscriptions WHERE endpoint = ?", [endpoint]);

export const countSubscriptions = async () =>
  (await all<{ n: number }>("SELECT COUNT(*) AS n FROM push_subscriptions"))[0]?.n ?? 0;

/**
 * Sends one notification to every registered device. `slot` names the meal so the
 * scheduler can say something specific, and the body comes from the same nudge
 * engine the app's Today card uses, so it reflects the real state of the day.
 */
export async function sendPush(slot: "breakfast" | "lunch" | "dinner" | "now", hour?: number) {
  if (!configured()) return { sent: 0, failed: 0, reason: "VAPID keys are not set" };

  const subs = await all<PushSubscriptionRow>("SELECT endpoint, p256dh, auth FROM push_subscriptions");
  if (subs.length === 0) return { sent: 0, failed: 0, reason: "No devices have enabled notifications" };

  const snap = await snapshot();
  const message = nudge(snap, hour);
  const titles: Record<typeof slot, string> = {
    breakfast: "Log your breakfast",
    lunch: "Log your lunch",
    dinner: "Log your dinner",
    now: message.title,
  };
  const payload = JSON.stringify({
    title: titles[slot],
    body: slot === "now" ? message.body : `${message.title} — ${message.body}`,
    url: slot === "now" ? "/" : "/log",
    tag: slot,
  });

  let sent = 0;
  let failed = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      );
      sent++;
    } catch (e) {
      failed++;
      // 404/410 mean the device unsubscribed; stop trying it.
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await removeSubscription(sub.endpoint);
    }
  }
  return { sent, failed };
}

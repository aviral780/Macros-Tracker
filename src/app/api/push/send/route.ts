import { z } from "zod";
import { handle, json } from "@/lib/http";
import { sendPush } from "@/lib/push";

const Slot = z.enum(["breakfast", "lunch", "dinner", "now"]).catch("now");

/**
 * Called by the scheduler (Vercel Cron, GitHub Actions, any cron service) with the
 * APP_TOKEN header, and by the Settings page to send a test to this device.
 */
async function trigger(req: Request) {
  const params = new URL(req.url).searchParams;
  const slot = Slot.parse(params.get("slot"));
  const hour = Number(params.get("hour"));
  return json(await sendPush(slot, Number.isFinite(hour) && hour >= 0 && hour <= 23 ? hour : undefined));
}

export const GET = handle(trigger);
export const POST = handle(trigger);

import { z } from "zod";
import { handle, json } from "@/lib/http";
import { countSubscriptions, removeSubscription, saveSubscription } from "@/lib/push";

const Body = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export const GET = handle(async () =>
  json({ devices: await countSubscriptions(), configured: !!process.env.VAPID_PUBLIC_KEY, publicKey: process.env.VAPID_PUBLIC_KEY ?? "" }),
);

export const POST = handle(async (req: Request) => {
  const sub = Body.parse(await req.json());
  await saveSubscription(sub);
  return json({ ok: true, devices: await countSubscriptions() }, 201);
});

export const DELETE = handle(async (req: Request) => {
  const { endpoint } = z.object({ endpoint: z.string().url() }).parse(await req.json());
  await removeSubscription(endpoint);
  return json({ ok: true, devices: await countSubscriptions() });
});

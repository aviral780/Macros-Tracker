import { handle, json } from "@/lib/http";
import { nudge, pepTalk, snapshot } from "@/lib/nudge";

/**
 * Drives both the in-app card and the iOS Shortcuts reminders.
 * `?format=text` returns a bare line so a Shortcut can drop it straight into a notification.
 */
export const GET = handle(async (req: Request) => {
  const params = new URL(req.url).searchParams;
  const hourParam = Number(params.get("hour"));
  const snap = await snapshot();
  const message = nudge(snap, Number.isFinite(hourParam) && hourParam >= 0 && hourParam <= 23 ? hourParam : undefined);

  if (params.get("format") === "text") {
    return new Response(`${message.title} — ${message.body}`, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return json({
    ...message,
    snapshot: snap,
    pep: params.get("pep") === "1" ? await pepTalk(snap) : undefined,
  });
});

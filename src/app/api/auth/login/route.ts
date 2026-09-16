import { z } from "zod";
import { authConfigured, createSession, passwordMatches, sessionCookie } from "@/lib/auth";
import { fail, handle, json } from "@/lib/http";

const Body = z.object({ password: z.string().min(1, "Enter your password") });

export const POST = handle(async (req: Request) => {
  if (!authConfigured()) return fail("No password is configured for this app", 503);
  const { password } = Body.parse(await req.json());
  if (!(await passwordMatches(password))) return fail("That password doesn't match", 401);

  const response = json({ ok: true });
  response.headers.set("Set-Cookie", sessionCookie(await createSession(), 60 * 86_400));
  return response;
});

export const DELETE = handle(async () => {
  const response = json({ ok: true });
  response.headers.set("Set-Cookie", sessionCookie("", 0));
  return response;
});

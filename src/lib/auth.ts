/**
 * Single-user auth for a personal app. The session cookie is a signed expiry stamp,
 * so nothing needs storing server side and it verifies inside edge middleware.
 * Everything here uses Web Crypto only — no Node APIs — so it runs in both runtimes.
 */
const encoder = new TextEncoder();

export const SESSION_COOKIE = "macros_session";
const SESSION_DAYS = 60;

const password = () => process.env.APP_PASSWORD ?? "";
const secret = () => process.env.AUTH_SECRET || password();

/** With no password set the app is open, which is fine on a laptop and refused in production. */
export const authConfigured = () => password().length > 0;

const toHex = (buffer: ArrayBuffer) =>
  [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function sign(value: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

/** Length-independent comparison so a wrong guess leaks nothing through timing. */
const sameDigest = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export async function createSession() {
  const expiry = String(Date.now() + SESSION_DAYS * 86_400_000);
  return `${expiry}.${await sign(expiry)}`;
}

export async function verifySession(token: string | undefined) {
  if (!token) return false;
  const [expiry, digest] = token.split(".");
  if (!expiry || !digest) return false;
  if (!Number(expiry) || Number(expiry) < Date.now()) return false;
  return sameDigest(digest, await sign(expiry));
}

export async function passwordMatches(candidate: string) {
  if (!authConfigured()) return false;
  return sameDigest(await sign(candidate), await sign(password()));
}

/**
 * Machine callers (iOS Shortcuts, the notification scheduler) send a token header
 * instead of signing in, since they can't hold a cookie session.
 */
export function tokenMatches(request: Request) {
  const expected = process.env.APP_TOKEN;
  if (!expected) return false;
  const sent = request.headers.get("x-macros-token") ?? new URL(request.url).searchParams.get("token");
  return !!sent && sameDigest(sent, expected);
}

export const sessionCookie = (value: string, maxAgeSeconds: number) =>
  [
    `${SESSION_COOKIE}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
    process.env.NODE_ENV === "production" ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");

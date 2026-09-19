import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, authConfigured, tokenMatches, verifySession } from "@/lib/auth";

/** Endpoints reachable with a token header, for iOS Shortcuts, Health Auto Export and the cron. */
const MACHINE_PATHS = ["/api/health", "/api/nudge", "/api/push/send"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!authConfigured()) {
    // An unprotected public deployment would expose the whole log, so refuse to serve one.
    if (process.env.NODE_ENV === "production") {
      return new NextResponse(
        "This app has no password set. Add APP_PASSWORD in your hosting environment and redeploy.",
        { status: 503, headers: { "Content-Type": "text/plain" } },
      );
    }
    return NextResponse.next();
  }

  if (await verifySession(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (MACHINE_PATHS.some((p) => pathname.startsWith(p)) && tokenMatches(request)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  }

  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except the login screen, its endpoint, and the assets needed to render it.
  matcher: ["/((?!login|api/auth/login|_next/static|_next/image|icon.svg|apple-icon|manifest.webmanifest|sw.js|favicon.ico).*)"],
};

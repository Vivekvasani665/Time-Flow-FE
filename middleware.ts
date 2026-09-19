import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];

/**
 * UX-only gate: bounce visitors without any session cookie to /login before
 * rendering the app shell. Tokens are validated by the API on every request —
 * this is not a security boundary.
 *
 * The refresh cookie is scoped to /api/auth, so page requests can't see it; the
 * API also sets a non-secret `tf_session` marker on path / for exactly this
 * check. With only the marker present (access token lapsed), the page renders
 * and the API client refreshes before its first request. Redirecting away
 * from /login is done client-side after the session is verified, which avoids
 * redirect loops when a stale cookie is present.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.has("tf_access") || request.cookies.has("tf_session");
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!hasSession && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Skip API proxy, uploads, Next internals and static files.
  matcher: ["/((?!api|uploads|admin/queues|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};

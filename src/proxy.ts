import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// LEARNING NOTE: Proxy runs before every matched request, so it only does a fast
// cookie check and never touches the database. Anyone can forge a cookie, so this
// is a convenience redirect and not security: the real check is getUser(). API
// routes are excluded so they answer with their own 401 instead of a redirect.

export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login|signup).*)"],
};

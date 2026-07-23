import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Route protection runs on the edge using only the JWT session cookie.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Protect everything except Next internals, the auth API, the login page, and
  // the cron endpoint (which authenticates itself with CRON_SECRET, not a
  // browser session).
  matcher: ["/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico|login).*)"],
};

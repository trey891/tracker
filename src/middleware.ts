import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Route protection runs on the edge using only the JWT session cookie.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Protect everything except Next internals, the auth API, and the login page.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|login).*)"],
};

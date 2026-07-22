import type { NextAuthConfig } from "next-auth";

// Edge-safe config (no Prisma / bcrypt here) so it can be used by middleware.
// The Credentials provider with its DB lookup lives in src/auth.ts.
export const authConfig: NextAuthConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  trustHost: true,
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const onLogin = nextUrl.pathname.startsWith("/login");
      if (onLogin) {
        if (isLoggedIn) return Response.redirect(new URL("/dashboard", nextUrl));
        return true;
      }
      return isLoggedIn; // everything else requires a session
    },
    jwt({ token, user }) {
      if (user) {
        token.initials = (user as { initials?: string }).initials;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? session.user.id;
        session.user.initials = (token.initials as string) ?? "";
        session.user.role = (token.role as string) ?? "";
      }
      return session;
    },
  },
  providers: [], // added in src/auth.ts
};

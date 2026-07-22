import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      initials: string;
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    initials?: string;
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    initials?: string;
    role?: string;
  }
}

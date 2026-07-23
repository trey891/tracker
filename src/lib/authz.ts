import type { Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type Access = "admin" | "contributor" | "viewer";

const RANK: Record<Access, number> = { viewer: 0, contributor: 1, admin: 2 };

function normalize(v: string | undefined | null): Access | null {
  return v === "admin" || v === "contributor" || v === "viewer" ? v : null;
}

// Resolve the caller's access level. Falls back to a DB lookup for sessions
// issued before the access claim existed in the JWT.
export async function getAccess(): Promise<{ session: Session | null; access: Access }> {
  const session = await auth();
  if (!session?.user) return { session: null, access: "viewer" };
  let access = normalize(session.user.access);
  if (!access && session.user.email) {
    const u = await prisma.user.findUnique({
      where: { email: session.user.email.toLowerCase() },
      select: { access: true },
    });
    access = normalize(u?.access) ?? "viewer";
  }
  return { session, access: access ?? "viewer" };
}

// Guard for mutations. Throws unless the caller is signed in at >= min level.
export async function requireAccess(min: "contributor" | "admin"): Promise<Session> {
  const { session, access } = await getAccess();
  if (!session?.user) throw new Error("Unauthorized");
  if (RANK[access] < RANK[min]) {
    throw new Error(min === "admin" ? "Only the admin can do that." : "Your account is view-only.");
  }
  return session;
}

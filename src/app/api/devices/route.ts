import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// The native app posts its APNs token here after registering for push.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const { token, platform } = await request.json().catch(() => ({}) as { token?: string; platform?: string });
  if (!token || typeof token !== "string") return new Response("Missing token", { status: 400 });

  // A token belongs to one device; move it to the current user if it reappears.
  await prisma.deviceToken.upsert({
    where: { token },
    update: { userId: session.user.id, platform: platform === "android" ? "android" : "ios" },
    create: { token, userId: session.user.id, platform: platform === "android" ? "android" : "ios" },
  });

  return Response.json({ ok: true });
}

// Unregister (e.g., on sign-out) — best effort.
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const { token } = await request.json().catch(() => ({}) as { token?: string });
  if (token) await prisma.deviceToken.deleteMany({ where: { token, userId: session.user.id } });
  return Response.json({ ok: true });
}

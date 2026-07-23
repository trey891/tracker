import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentProjectId } from "@/lib/project";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const projectId = await getCurrentProjectId();

  const att = await prisma.attachment.findUnique({ where: { id } });
  if (!att || (projectId && att.projectId !== projectId)) {
    return new Response("Not found", { status: 404 });
  }

  const download = new URL(_request.url).searchParams.get("download") === "1";
  const body = new Uint8Array(att.data as unknown as Buffer);
  return new Response(body, {
    headers: {
      "Content-Type": att.contentType,
      "Content-Length": String(att.size),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${att.filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

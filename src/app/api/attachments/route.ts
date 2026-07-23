import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentProjectId } from "@/lib/project";

export const dynamic = "force-dynamic";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB — stays under Vercel's serverless body limit

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const projectId = await getCurrentProjectId();
  if (!projectId) return new Response("No project", { status: 404 });

  const form = await request.formData();
  const file = form.get("file");
  const taskId = (form.get("taskId") as string) || null;
  const allowanceId = (form.get("allowanceId") as string) || null;

  if (!(file instanceof File) || file.size === 0) {
    return new Response("No file provided", { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return new Response(`File too large (max ${MAX_BYTES / 1024 / 1024} MB)`, { status: 413 });
  }

  // Verify the target belongs to this project (avoid cross-project writes).
  if (taskId) {
    const t = await prisma.task.findFirst({ where: { id: taskId, projectId }, select: { id: true } });
    if (!t) return new Response("Invalid task", { status: 400 });
  }
  if (allowanceId) {
    const a = await prisma.allowance.findFirst({ where: { id: allowanceId, projectId }, select: { id: true } });
    if (!a) return new Response("Invalid allowance", { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const created = await prisma.attachment.create({
    data: {
      projectId,
      taskId,
      allowanceId,
      filename: file.name.slice(0, 255),
      contentType: file.type || "application/octet-stream",
      size: bytes.length,
      data: bytes,
      uploadedBy: session.user.name ?? session.user.email ?? null,
    },
    select: { id: true, filename: true, size: true, contentType: true, createdAt: true, uploadedBy: true },
  });

  return Response.json(created, { status: 201 });
}

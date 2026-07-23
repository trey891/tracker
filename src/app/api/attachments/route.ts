import { auth } from "@/auth";
import { getAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getCurrentProjectId } from "@/lib/project";

export const dynamic = "force-dynamic";

const MAX_DOC = 4 * 1024 * 1024; // 4 MB for documents
const MAX_PHOTO = 5 * 1024 * 1024; // 5 MB for progress photos

export async function POST(request: Request) {
  const { session, access } = await getAccess();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  if (access === "viewer") return new Response("Your account is view-only.", { status: 403 });

  const projectId = await getCurrentProjectId();
  if (!projectId) return new Response("No project", { status: 404 });

  const form = await request.formData();
  const file = form.get("file");
  const taskId = (form.get("taskId") as string) || null;
  const allowanceId = (form.get("allowanceId") as string) || null;
  const kind = (form.get("kind") as string) === "photo" ? "photo" : "doc";
  const description = (form.get("description") as string)?.trim() || null;
  const takenRaw = (form.get("takenDate") as string) || "";
  const takenDate = takenRaw ? new Date(takenRaw) : null;

  if (!(file instanceof File) || file.size === 0) {
    return new Response("No file provided", { status: 400 });
  }
  if (kind === "photo" && !file.type.startsWith("image/")) {
    return new Response("Only image files are allowed for progress photos", { status: 400 });
  }
  const max = kind === "photo" ? MAX_PHOTO : MAX_DOC;
  if (file.size > max) {
    return new Response(`File too large (max ${max / 1024 / 1024} MB)`, { status: 413 });
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
      kind,
      description,
      takenDate: takenDate && !Number.isNaN(takenDate.getTime()) ? takenDate : null,
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

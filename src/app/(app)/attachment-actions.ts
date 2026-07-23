"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentProjectId } from "@/lib/project";

export async function deleteAttachment(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const projectId = await getCurrentProjectId();
  const att = await prisma.attachment.findUnique({ where: { id }, select: { projectId: true } });
  if (!att || (projectId && att.projectId !== projectId)) throw new Error("Not found");
  await prisma.attachment.delete({ where: { id } });
  revalidatePath("/tasks");
  revalidatePath("/pco-log");
}

// Returns attachment metadata (no bytes) for a given target.
export async function listAttachments(where: { taskId?: string; allowanceId?: string; projectLevel?: boolean }) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const projectId = await getCurrentProjectId();
  if (!projectId) return [];
  const filter: Record<string, unknown> = { projectId };
  if (where.taskId) filter.taskId = where.taskId;
  else if (where.allowanceId) filter.allowanceId = where.allowanceId;
  else if (where.projectLevel) {
    filter.taskId = null;
    filter.allowanceId = null;
  }
  return prisma.attachment.findMany({
    where: filter,
    orderBy: { createdAt: "desc" },
    select: { id: true, filename: true, size: true, contentType: true, uploadedBy: true, createdAt: true },
  });
}

// Edit an existing photo's date taken and/or description.
export async function updatePhoto(id: string, data: { takenDate?: string | null; description?: string | null }) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const projectId = await getCurrentProjectId();
  if (!projectId) throw new Error("No project");

  const patch: { takenDate?: Date | null; description?: string | null } = {};
  if ("takenDate" in data) {
    const raw = (data.takenDate ?? "").trim();
    const d = raw ? new Date(raw) : null;
    patch.takenDate = d && !Number.isNaN(d.getTime()) ? d : null;
  }
  if ("description" in data) patch.description = (data.description ?? "").trim() || null;

  await prisma.attachment.updateMany({ where: { id, projectId, kind: "photo" }, data: patch });
  revalidatePath("/photos");
}

// Persist descriptions entered in the PDF photo picker before generating.
export async function savePhotoDescriptions(updates: { id: string; description: string }[]) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const projectId = await getCurrentProjectId();
  if (!projectId) throw new Error("No project");
  for (const u of updates) {
    const desc = u.description.trim();
    await prisma.attachment.updateMany({
      where: { id: u.id, projectId, kind: "photo" },
      data: { description: desc || null },
    });
  }
  revalidatePath("/photos");
}

// Progress photos for the current project (newest first) — used by the PDF
// report's photo picker.
export async function listPhotos() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const projectId = await getCurrentProjectId();
  if (!projectId) return [];
  const rows = await prisma.attachment.findMany({
    where: { projectId, kind: "photo" },
    orderBy: [{ takenDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    select: { id: true, filename: true, description: true, takenDate: true, createdAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    filename: r.filename,
    description: r.description,
    takenDate: r.takenDate ? r.takenDate.toISOString().slice(0, 10) : null,
    createdAt: r.createdAt.toISOString(),
  }));
}

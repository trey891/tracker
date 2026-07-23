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

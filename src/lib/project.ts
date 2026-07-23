import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const PROJECT_COOKIE = "pulse_project";

export async function getAllProjects() {
  return prisma.project.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, code: true } });
}

/**
 * The project the user is currently viewing. Uses a cookie, falling back to the
 * first project. Returns null only when there are no projects at all.
 */
export async function getCurrentProject() {
  const store = await cookies();
  const wanted = store.get(PROJECT_COOKIE)?.value;
  if (wanted) {
    const p = await prisma.project.findUnique({ where: { id: wanted } });
    if (p) return p;
  }
  return prisma.project.findFirst({ orderBy: { createdAt: "asc" } });
}

export async function getCurrentProjectId(): Promise<string | null> {
  const p = await getCurrentProject();
  return p?.id ?? null;
}

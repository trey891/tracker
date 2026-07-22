"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentProjectId } from "@/lib/project";
import { getTasks, statusCounts } from "@/lib/data";

/**
 * Freeze the current task-status distribution into the weekly trend. Publishing
 * again on the same calendar day updates that day's snapshot rather than adding
 * a duplicate — mirroring the "publish Friday prior to the weekly meeting" flow.
 */
export async function publishWeeklySnapshot() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const projectId = await getCurrentProjectId();
  if (!projectId) throw new Error("No project");

  const tasks = await getTasks(projectId);
  const c = statusCounts(tasks);
  const counts = {
    onTrack: c["On Track"],
    needsAttention: c["Needs Attention"],
    blocked: c["Blocked"],
    done: c["Done"],
  };

  const label = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const latest = await prisma.weeklyStatus.findFirst({
    where: { projectId },
    orderBy: { orderIndex: "desc" },
  });

  if (latest && latest.week === label) {
    await prisma.weeklyStatus.update({ where: { id: latest.id }, data: counts });
  } else {
    await prisma.weeklyStatus.create({
      data: { projectId, week: label, orderIndex: (latest?.orderIndex ?? -1) + 1, ...counts },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/analytics");
}

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getPrimaryProjectId } from "@/lib/data";
import { isStatus, isPriority, isWorkstream } from "@/lib/constants";
import { requireAccess } from "@/lib/authz";
import { sendPush } from "@/lib/push";

// Contributors and the admin can change tasks; viewers cannot.
const requireSession = () => requireAccess("contributor");

// Fire a push when a task crosses into Blocked (no-op unless APNs is configured).
async function notifyIfNewlyBlocked(id: string, prevStatus: string, newStatus: string) {
  if (newStatus !== "Blocked" || prevStatus === "Blocked") return;
  const t = await prisma.task.findUnique({ where: { id }, select: { title: true, blocker: true } });
  if (t) await sendPush({ title: "Task blocked", body: `${t.title}${t.blocker ? ` — ${t.blocker}` : ""}` });
}

function parse(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const workstream = String(formData.get("workstream") ?? "");
  const status = String(formData.get("status") ?? "On Track");
  const priority = String(formData.get("priority") ?? "Medium");
  const lead = String(formData.get("lead") ?? "").trim() || null;
  const deadlineRaw = String(formData.get("deadline") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  const blocker = String(formData.get("blocker") ?? "").trim() || null;
  const topIssue = formData.get("topIssue") === "on" || formData.get("topIssue") === "true";

  if (!title) throw new Error("Title is required");
  if (!isWorkstream(workstream)) throw new Error("Invalid workstream");
  if (!isStatus(status)) throw new Error("Invalid status");
  if (!isPriority(priority)) throw new Error("Invalid priority");

  const deadline = deadlineRaw ? new Date(deadlineRaw) : null;

  return {
    title,
    workstream,
    status,
    priority,
    lead,
    deadline: deadline && !Number.isNaN(deadline.getTime()) ? deadline : null,
    note,
    // A blocker only makes sense on a blocked task, but we keep whatever's typed.
    blocker: status === "Blocked" ? blocker : blocker,
    topIssue,
  };
}

export async function createTask(formData: FormData) {
  await requireSession();
  const projectId = await getPrimaryProjectId();
  if (!projectId) throw new Error("No project");
  await prisma.task.create({ data: { projectId, ...parse(formData) } });
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
}

export async function updateTask(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  const prev = await prisma.task.findUnique({ where: { id }, select: { status: true } });
  const data = parse(formData);
  await prisma.task.update({ where: { id }, data });
  await notifyIfNewlyBlocked(id, prev?.status ?? "", data.status);
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
}

export async function deleteTask(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  await prisma.task.delete({ where: { id } });
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
}

// Quick inline status change from the table.
export async function setTaskStatus(id: string, status: string) {
  await requireSession();
  if (!isStatus(status)) throw new Error("Invalid status");
  const prev = await prisma.task.findUnique({ where: { id }, select: { status: true } });
  await prisma.task.update({ where: { id }, data: { status } });
  await notifyIfNewlyBlocked(id, prev?.status ?? "", status);
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
}

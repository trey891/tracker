"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentProjectId } from "@/lib/project";

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
}
function num(fd: FormData, key: string): number {
  const raw = String(fd.get(key) ?? "").trim().replace(/[$,]/g, "");
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}
function refresh() {
  revalidatePath("/pco-log");
  revalidatePath("/dashboard");
}

export async function upsertAllowance(formData: FormData) {
  await requireSession();
  const projectId = await getCurrentProjectId();
  if (!projectId) throw new Error("No project");
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required");
  const amount = num(formData, "amount");
  const used = num(formData, "used");
  const balance = String(formData.get("balance") ?? "").trim() === "" ? amount - used : num(formData, "balance");
  const data = {
    name,
    amount,
    used,
    balance,
    pcReference: String(formData.get("pcReference") ?? "").trim() || null,
  };
  if (id) await prisma.allowance.update({ where: { id }, data });
  else await prisma.allowance.create({ data: { projectId, ...data } });
  refresh();
}

export async function deleteAllowance(id: string) {
  await requireSession();
  await prisma.allowance.delete({ where: { id } });
  refresh();
}

// Edit a PCO status bucket (count + value).
export async function updateBucket(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  await prisma.pcoStatusBucket.update({
    where: { id },
    data: { count: Math.round(num(formData, "count")), value: num(formData, "value") },
  });
  refresh();
}

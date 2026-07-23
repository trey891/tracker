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

// ---- PCO line items (Cost Tracking log) ----
function numOrNull(v: FormDataEntryValue | null): number | null {
  const raw = String(v ?? "").trim().replace(/[$,]/g, "");
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

type PcoPatch = {
  number?: string | null;
  scope?: string;
  status?: string;
  value?: number | null;
  oco?: string | null;
  gcFunding?: string | null;
  creFunding?: string;
  contractorAllowance?: number | null;
  buyout?: number | null;
  contractorContingency?: number | null;
  recoupableCosts?: number | null;
  reason?: string;
  notes?: string | null;
};

export async function createPco(fields?: PcoPatch) {
  await requireSession();
  const projectId = await getCurrentProjectId();
  if (!projectId) throw new Error("No project");
  const last = await prisma.pco.findFirst({ where: { projectId }, orderBy: { orderIndex: "desc" } });
  const created = await prisma.pco.create({
    data: {
      projectId,
      orderIndex: (last?.orderIndex ?? -1) + 1,
      scope: fields?.scope?.trim() || "New PCO",
      status: fields?.status ?? "Pending",
      reason: fields?.reason ?? "Other",
      creFunding: fields?.creFunding ?? "None/Other",
      number: fields?.number ?? null,
      value: fields?.value ?? null,
      oco: fields?.oco ?? null,
      gcFunding: fields?.gcFunding ?? null,
      contractorAllowance: fields?.contractorAllowance ?? null,
      buyout: fields?.buyout ?? null,
      contractorContingency: fields?.contractorContingency ?? null,
      recoupableCosts: fields?.recoupableCosts ?? null,
      notes: fields?.notes ?? null,
    },
  });
  refresh();
  return created.id;
}

// Partial update of a single PCO — used by inline cell edits and the edit modal.
export async function updatePco(id: string, patch: PcoPatch) {
  await requireSession();
  const projectId = await getCurrentProjectId();
  if (!projectId) throw new Error("No project");
  const existing = await prisma.pco.findFirst({ where: { id, projectId }, select: { id: true } });
  if (!existing) throw new Error("Not found");
  await prisma.pco.update({ where: { id }, data: patch });
  refresh();
}

export async function deletePco(id: string) {
  await requireSession();
  const projectId = await getCurrentProjectId();
  if (!projectId) throw new Error("No project");
  await prisma.pco.deleteMany({ where: { id, projectId } });
  refresh();
}

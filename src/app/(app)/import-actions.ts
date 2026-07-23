"use server";

import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getCurrentProjectId } from "@/lib/project";
import type { Change, Proposal } from "@/lib/import/types";

// Apply the user-approved subset of a parsed import batch. Nothing is written
// until this runs with explicit keys.
export async function applyImport(batchId: string, acceptedKeys: string[]) {
  const session = await requireAccess("contributor");
  const projectId = await getCurrentProjectId();
  if (!projectId) throw new Error("No project");

  const batch = await prisma.importBatch.findFirst({ where: { id: batchId, projectId } });
  if (!batch) throw new Error("Import not found");
  if (batch.status !== "pending") throw new Error("This import was already applied.");

  const proposal = batch.proposal as unknown as Proposal;
  const accepted = new Set(acceptedKeys);
  const changes = proposal.changes.filter((c) => accepted.has(c.key));

  // Group scalar updates per entity.
  const finData: Record<string, Record<string, unknown>> = {};
  const commitData: Record<string, Record<string, unknown>> = {};
  const pcoUpdates: { id: string; data: Record<string, unknown> }[] = [];
  const pcoCreates: Change[] = [];

  for (const c of changes) {
    if (c.target === "financials" && c.entityId && c.field) (finData[c.entityId] ??= {})[c.field] = c.value;
    else if (c.target === "commitment" && c.entityId && c.field) (commitData[c.entityId] ??= {})[c.field] = c.value;
    else if (c.target === "pco" && c.op === "update" && c.entityId) pcoUpdates.push({ id: c.entityId, data: c.record ?? {} });
    else if (c.target === "pco" && c.op === "create" && c.record) pcoCreates.push(c);
  }

  const ops: Promise<unknown>[] = [];
  // Dynamic field maps — cast to satisfy Prisma's specific update input types.
  for (const [id, data] of Object.entries(finData)) ops.push(prisma.financialSnapshot.update({ where: { id }, data: data as never }));
  for (const [id, data] of Object.entries(commitData)) ops.push(prisma.commitment.update({ where: { id }, data: data as never }));
  for (const u of pcoUpdates) ops.push(prisma.pco.update({ where: { id: u.id }, data: u.data as never }));
  await Promise.all(ops);

  if (pcoCreates.length) {
    const last = await prisma.pco.findFirst({ where: { projectId }, orderBy: { orderIndex: "desc" } });
    let idx = (last?.orderIndex ?? -1) + 1;
    await prisma.pco.createMany({
      data: pcoCreates.map((c) => {
        const r = c.record as Record<string, unknown>;
        return {
          projectId,
          orderIndex: idx++,
          number: (r.number as string) ?? null,
          scope: (r.scope as string) ?? "PCO",
          status: (r.status as string) ?? "Pending",
          value: (r.value as number) ?? null,
          oco: r.oco != null ? String(r.oco) : null,
          gcFunding: (r.gcFunding as string) ?? null,
          creFunding: (r.creFunding as string) ?? "None/Other",
          contractorAllowance: (r.contractorAllowance as number) ?? null,
          buyout: (r.buyout as number) ?? null,
          contractorContingency: (r.contractorContingency as number) ?? null,
          recoupableCosts: (r.recoupableCosts as number) ?? null,
          reason: (r.reason as string) ?? "Other",
          notes: (r.notes as string) ?? null,
        };
      }),
    });
  }

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: { status: "applied", appliedBy: session.user.name ?? session.user.email ?? null, appliedAt: new Date() },
  });

  revalidatePath("/hard-cost");
  revalidatePath("/pco-log");
  revalidatePath("/dashboard");
  revalidatePath("/development");

  return { applied: changes.length };
}

export async function discardImport(batchId: string) {
  await requireAccess("contributor");
  const projectId = await getCurrentProjectId();
  await prisma.importBatch.updateMany({ where: { id: batchId, projectId: projectId ?? undefined, status: "pending" }, data: { status: "discarded" } });
}

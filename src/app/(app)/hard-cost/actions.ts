"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentProjectId } from "@/lib/project";
import { requireAccess } from "@/lib/authz";

const requireSession = () => requireAccess("contributor");

function num(fd: FormData, key: string): number | null {
  const raw = String(fd.get(key) ?? "").trim().replace(/[$,]/g, "");
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
function int(fd: FormData, key: string): number | null {
  const n = num(fd, key);
  return n == null ? null : Math.round(n);
}
function date(fd: FormData, key: string): Date | null {
  const raw = String(fd.get(key) ?? "").trim();
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function refresh() {
  revalidatePath("/hard-cost");
  revalidatePath("/dashboard");
}

// Fields the financials editor exposes (kept in sync with the form). The 5
// roll-up figures (currentBudget, costsToDate, projectedFinalCost,
// contingencyBalance, overUnderBeforeContingency) are deliberately excluded —
// they are owned by the protected roll-up rows and must not be nulled here.
const FIN_FLOAT = [
  "originalBudget", "approvedChanges", "reallocationsFromTI",
  "commitments", "nonContractedInvoiced", "ffeAllowance", "currentCommitments", "uncommittedBudget",
  "unspentCommitments",
  "allowances", "pendingCosPcos", "forecasted",
  "contingencyNeeded", "trendingContingencyAtCompletion", "contractorContingency",
  "pcosApprovedPendingCo", "pcosPending", "totalPcos", "cosApproved", "totalCos",
  "softCostBudget", "softCostCommitments", "softCostContingency", "softCostUncommitted", "softCostContingencyBalance",
  "equityBudget", "equityRequested", "loanBudget", "loanRequested",
] as const;
const FIN_INT = [
  "pcosApprovedPendingCoQty", "pcosPendingQty", "totalPcosQty", "cosApprovedQty", "totalCosQty",
] as const;

export async function updateFinancials(formData: FormData) {
  await requireSession();
  const projectId = await getCurrentProjectId();
  if (!projectId) throw new Error("No project");

  const data: Record<string, number | null | Date> = {};
  for (const k of FIN_FLOAT) data[k] = num(formData, k);
  for (const k of FIN_INT) data[k] = int(formData, k);
  const asOf = date(formData, "asOfDate");
  if (asOf) data.asOfDate = asOf;

  const existing = await prisma.financialSnapshot.findFirst({
    where: { projectId },
    orderBy: { asOfDate: "desc" },
  });

  if (existing) {
    await prisma.financialSnapshot.update({ where: { id: existing.id }, data });
  } else {
    await prisma.financialSnapshot.create({ data: { projectId, asOfDate: asOf ?? new Date(), ...data } });
  }
  refresh();
}

// ---- Commitments ----
export async function upsertCommitment(formData: FormData) {
  await requireSession();
  const projectId = await getCurrentProjectId();
  if (!projectId) throw new Error("No project");
  const id = String(formData.get("id") ?? "");
  const data = {
    vendor: String(formData.get("vendor") ?? "").trim(),
    contract: String(formData.get("contract") ?? "").trim() || null,
    status: String(formData.get("status") ?? "Approved").trim() || "Approved",
    startDate: date(formData, "startDate"),
    endDate: date(formData, "endDate"),
    originalContract: num(formData, "originalContract"),
    changeOrderAmount: num(formData, "changeOrderAmount"),
    totalContract: num(formData, "totalContract"),
    pendingCos: num(formData, "pendingCos"),
    invoiced: num(formData, "invoiced"),
    remaining: num(formData, "remaining"),
  };
  if (!data.vendor) throw new Error("Vendor is required");
  if (id) await prisma.commitment.update({ where: { id }, data });
  else await prisma.commitment.create({ data: { projectId, ...data } });
  refresh();
}

export async function deleteCommitment(id: string) {
  await requireSession();
  await prisma.commitment.delete({ where: { id } });
  refresh();
}

// ---- Milestones ----
export async function upsertMilestone(formData: FormData) {
  await requireSession();
  const projectId = await getCurrentProjectId();
  if (!projectId) throw new Error("No project");
  const id = String(formData.get("id") ?? "");
  const data = {
    description: String(formData.get("description") ?? "").trim(),
    seq: int(formData, "seq"),
    baseDate: date(formData, "baseDate"),
    contractDate: date(formData, "contractDate"),
    currentDate: date(formData, "currentDate"),
    varianceDays: int(formData, "varianceDays"),
  };
  if (!data.description) throw new Error("Description is required");
  if (id) await prisma.milestone.update({ where: { id }, data });
  else await prisma.milestone.create({ data: { projectId, ...data } });
  refresh();
}

export async function deleteMilestone(id: string) {
  await requireSession();
  await prisma.milestone.delete({ where: { id } });
  refresh();
}

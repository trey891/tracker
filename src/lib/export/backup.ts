import { prisma } from "@/lib/prisma";
import { getLatestFinancials } from "@/lib/data";

// Off-platform archive: one CSV per dataset, per project. Text/data only — no
// images or documents — so the backup stays small and portable (opens in
// Excel/Sheets). Used by the weekly export email and the on-demand admin export.

export type BackupFile = { filename: string; content: string };

function cell(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.join(","), ...rows.map((r) => r.map(cell).join(","))].join("\n");
}

function slug(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "project";
}

async function projectFiles(project: { id: string; name: string; code: string | null }): Promise<BackupFile[]> {
  const prefix = slug(project.code || project.name);

  const [tasks, pcos, commitments, milestones, allowances, fin] = await Promise.all([
    prisma.task.findMany({ where: { projectId: project.id }, orderBy: [{ topIssue: "desc" }, { workstream: "asc" }] }),
    prisma.pco.findMany({ where: { projectId: project.id }, orderBy: { orderIndex: "asc" } }),
    prisma.commitment.findMany({ where: { projectId: project.id }, orderBy: { totalContract: "desc" } }),
    prisma.milestone.findMany({ where: { projectId: project.id }, orderBy: { seq: "asc" } }),
    prisma.allowance.findMany({ where: { projectId: project.id }, orderBy: { amount: "desc" } }),
    getLatestFinancials(project.id),
  ]);

  const files: BackupFile[] = [];

  files.push({
    filename: `${prefix}_tasks.csv`,
    content: toCsv(
      ["Title", "Workstream", "Lead", "Status", "Priority", "Deadline", "Top Issue", "Note", "Blocker"],
      tasks.map((x) => [x.title, x.workstream, x.lead, x.status, x.priority, x.deadline, x.topIssue ? "Yes" : "", x.note, x.blocker]),
    ),
  });

  files.push({
    filename: `${prefix}_pco_log.csv`,
    content: toCsv(
      ["PCO #", "Scope", "Status", "Value", "OCO", "GC Funding", "CRE Funding", "Allowance", "Buyout", "Contingency", "Recoupable", "Reason", "Notes"],
      pcos.map((p) => [p.number, p.scope, p.status, p.value, p.oco, p.gcFunding, p.creFunding, p.contractorAllowance, p.buyout, p.contractorContingency, p.recoupableCosts, p.reason, p.notes]),
    ),
  });

  files.push({
    filename: `${prefix}_commitments.csv`,
    content: toCsv(
      ["Vendor", "Contract", "Status", "Original", "Change Orders", "Total", "Pending COs", "Invoiced", "Remaining"],
      commitments.map((c) => [c.vendor, c.contract, c.status, c.originalContract, c.changeOrderAmount, c.totalContract, c.pendingCos, c.invoiced, c.remaining]),
    ),
  });

  files.push({
    filename: `${prefix}_milestones.csv`,
    content: toCsv(
      ["Milestone", "Base Date", "Contract Date", "Current Date", "Variance (days)"],
      milestones.map((m) => [m.description, m.baseDate, m.contractDate, m.currentDate, m.varianceDays]),
    ),
  });

  files.push({
    filename: `${prefix}_allowances.csv`,
    content: toCsv(
      ["Allowance", "Amount", "Used", "Balance", "PC Ref"],
      allowances.map((a) => [a.name, a.amount, a.used, a.balance, a.pcReference]),
    ),
  });

  if (fin) {
    const f: [string, unknown][] = [
      ["As Of", fin.asOfDate],
      ["Original Budget (A)", fin.originalBudget],
      ["Current Budget (D)", fin.currentBudget],
      ["Current Commitments (H)", fin.currentCommitments],
      ["Uncommitted Budget (I)", fin.uncommittedBudget],
      ["Costs to Date (J)", fin.costsToDate],
      ["Unspent Commitments (K)", fin.unspentCommitments],
      ["Projected Final Cost (P)", fin.projectedFinalCost],
      ["HC Contingency Balance (R)", fin.contingencyBalance],
      ["PCOs Approved (pending CO)", fin.pcosApprovedPendingCo],
      ["PCOs Pending", fin.pcosPending],
      ["COs Approved", fin.cosApproved],
      ["Soft Cost Budget", fin.softCostBudget],
    ];
    files.push({ filename: `${prefix}_financials.csv`, content: toCsv(["Metric", "Amount"], f.map(([k, v]) => [k, v])) });
  }

  return files;
}

// Build the full CSV archive for every project in the workspace.
export async function buildBackupFiles(): Promise<BackupFile[]> {
  const projects = await prisma.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true } });
  const all: BackupFile[] = [];
  for (const p of projects) all.push(...(await projectFiles(p)));
  return all;
}

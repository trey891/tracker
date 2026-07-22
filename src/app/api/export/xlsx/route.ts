import ExcelJS from "exceljs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentProject } from "@/lib/project";
import { getLatestFinancials } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const project = await getCurrentProject();
  if (!project) return new Response("No project", { status: 404 });

  const [fin, tasks, commitments, milestones, buckets, allowances] = await Promise.all([
    getLatestFinancials(project.id),
    prisma.task.findMany({ where: { projectId: project.id }, orderBy: [{ topIssue: "desc" }, { workstream: "asc" }] }),
    prisma.commitment.findMany({ where: { projectId: project.id }, orderBy: { totalContract: "desc" } }),
    prisma.milestone.findMany({ where: { projectId: project.id }, orderBy: { seq: "asc" } }),
    prisma.pcoStatusBucket.findMany({ where: { projectId: project.id } }),
    prisma.allowance.findMany({ where: { projectId: project.id }, orderBy: { amount: "desc" } }),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Pulse";
  wb.created = new Date();

  const header = (ws: ExcelJS.Worksheet, cols: Partial<ExcelJS.Column>[]) => {
    ws.columns = cols;
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF12141C" } };
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  };
  const usd = '"$"#,##0';

  // --- Summary ---
  const s = wb.addWorksheet("Summary");
  s.addRow([project.name]);
  s.getRow(1).font = { bold: true, size: 14 };
  s.addRow([`Project #${project.code ?? ""}`]);
  s.addRow([`As of ${fin?.asOfDate ? fin.asOfDate.toLocaleDateString("en-US") : "—"}`]);
  s.addRow([]);
  const finRows: [string, number | null | undefined][] = [
    ["Original Budget (A)", fin?.originalBudget],
    ["Current Budget (D)", fin?.currentBudget],
    ["Current Commitments (H)", fin?.currentCommitments],
    ["Uncommitted Budget (I)", fin?.uncommittedBudget],
    ["Costs to Date (J)", fin?.costsToDate],
    ["Unspent Commitments (K)", fin?.unspentCommitments],
    ["Projected Final Cost (P)", fin?.projectedFinalCost],
    ["Over/(Under) before Contingency", fin?.overUnderBeforeContingency],
    ["HC Contingency Balance (R)", fin?.contingencyBalance],
    ["Trending Contingency @ Completion (S)", fin?.trendingContingencyAtCompletion],
    ["PCOs Approved (pending CO)", fin?.pcosApprovedPendingCo],
    ["PCOs Pending", fin?.pcosPending],
    ["COs Approved", fin?.cosApproved],
    ["Soft Cost Budget", fin?.softCostBudget],
  ];
  s.addRow(["Metric", "Amount"]).font = { bold: true };
  finRows.forEach(([k, v]) => {
    const r = s.addRow([k, v ?? null]);
    r.getCell(2).numFmt = usd;
  });
  s.getColumn(1).width = 38;
  s.getColumn(2).width = 18;

  // --- Tasks ---
  const t = wb.addWorksheet("Tasks");
  header(t, [
    { header: "Title", key: "title", width: 40 },
    { header: "Workstream", key: "workstream", width: 20 },
    { header: "Lead", key: "lead", width: 8 },
    { header: "Status", key: "status", width: 16 },
    { header: "Priority", key: "priority", width: 12 },
    { header: "Deadline", key: "deadline", width: 14 },
    { header: "Top Issue", key: "top", width: 10 },
    { header: "Note", key: "note", width: 50 },
    { header: "Blocker", key: "blocker", width: 32 },
  ]);
  tasks.forEach((x) =>
    t.addRow({
      title: x.title, workstream: x.workstream, lead: x.lead ?? "", status: x.status, priority: x.priority,
      deadline: x.deadline ? x.deadline.toLocaleDateString("en-US") : "", top: x.topIssue ? "★" : "",
      note: x.note ?? "", blocker: x.blocker ?? "",
    }),
  );

  // --- Commitments ---
  const c = wb.addWorksheet("Commitments");
  header(c, [
    { header: "Vendor", key: "vendor", width: 32 },
    { header: "Contract", key: "contract", width: 30 },
    { header: "Original", key: "orig", width: 16 },
    { header: "Change Orders", key: "co", width: 16 },
    { header: "Total", key: "total", width: 16 },
    { header: "Invoiced", key: "inv", width: 16 },
    { header: "Remaining", key: "rem", width: 16 },
  ]);
  commitments.forEach((x) => {
    const r = c.addRow({ vendor: x.vendor, contract: x.contract ?? "", orig: x.originalContract, co: x.changeOrderAmount, total: x.totalContract, inv: x.invoiced, rem: x.remaining });
    [3, 4, 5, 6, 7].forEach((i) => (r.getCell(i).numFmt = usd));
  });

  // --- PCOs ---
  const p = wb.addWorksheet("PCOs & Allowances");
  p.addRow(["PCO Status", "Count", "Value"]).font = { bold: true };
  buckets.forEach((b) => {
    const r = p.addRow([b.status, b.count, b.value]);
    r.getCell(3).numFmt = usd;
  });
  p.addRow([]);
  p.addRow(["Allowance", "Amount", "Used", "Balance", "PC Ref"]).font = { bold: true };
  allowances.forEach((a) => {
    const r = p.addRow([a.name, a.amount, a.used, a.balance, a.pcReference ?? ""]);
    [2, 3, 4].forEach((i) => (r.getCell(i).numFmt = usd));
  });
  p.getColumn(1).width = 34;
  [2, 3, 4, 5].forEach((i) => (p.getColumn(i).width = 16));

  // --- Milestones ---
  const m = wb.addWorksheet("Milestones");
  header(m, [
    { header: "Milestone", key: "d", width: 32 },
    { header: "Base", key: "b", width: 14 },
    { header: "Contract", key: "c", width: 14 },
    { header: "Current", key: "cur", width: 14 },
    { header: "Variance (days)", key: "v", width: 16 },
  ]);
  milestones.forEach((x) =>
    m.addRow({
      d: x.description,
      b: x.baseDate ? x.baseDate.toLocaleDateString("en-US") : "",
      c: x.contractDate ? x.contractDate.toLocaleDateString("en-US") : "",
      cur: x.currentDate ? x.currentDate.toLocaleDateString("en-US") : "",
      v: x.varianceDays ?? "",
    }),
  );

  const buffer = await wb.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);
  const safe = project.name.replace(/[^a-z0-9]+/gi, "_");
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safe}_${stamp}.xlsx"`,
    },
  });
}

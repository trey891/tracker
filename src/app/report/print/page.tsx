import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentProject } from "@/lib/project";
import { getLatestFinancials, statusCounts } from "@/lib/data";
import { GanttSchedule } from "@/components/GanttSchedule";
import { PrintTrigger } from "@/components/PrintTrigger";
import { money, pct, fullDate, shortDate } from "@/lib/format";
import { PCO_STATUS_COLOR } from "@/lib/constants";

export const dynamic = "force-dynamic";

const PRINT_CSS = `
@media print {
  @page { size: letter; margin: 0.5in; }
  html, body { background: #ffffff !important; }
  .no-print { display: none !important; }
}
.page-break { break-before: page; }
.avoid-break { break-inside: avoid; }
`;

const sumVal = (l: { value: number | null }[]) => l.reduce((a, p) => a + (p.value ?? 0), 0);

export default async function ReportPrintPage({ searchParams }: { searchParams: Promise<{ photos?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const project = await getCurrentProject();
  if (!project) redirect("/dashboard");

  const sp = await searchParams;
  const photoIds = (sp.photos ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 3);

  const [fin, tasks, milestones, commitments, pcos, allowances, coverPhotos, latestPhotos] = await Promise.all([
    getLatestFinancials(project.id),
    prisma.task.findMany({ where: { projectId: project.id }, orderBy: [{ topIssue: "desc" }, { status: "asc" }] }),
    prisma.milestone.findMany({ where: { projectId: project.id }, orderBy: { seq: "asc" } }),
    prisma.commitment.findMany({ where: { projectId: project.id }, orderBy: { totalContract: "desc" } }),
    prisma.pco.findMany({ where: { projectId: project.id }, orderBy: { orderIndex: "asc" } }),
    prisma.allowance.findMany({ where: { projectId: project.id }, orderBy: { amount: "desc" } }),
    photoIds.length
      ? prisma.attachment.findMany({
          where: { id: { in: photoIds }, projectId: project.id, kind: "photo" },
          select: { id: true, description: true, takenDate: true, createdAt: true },
        })
      : Promise.resolve([]),
    prisma.attachment.findMany({
      where: { projectId: project.id, kind: "photo" },
      orderBy: [{ takenDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      take: 6,
      select: { id: true, description: true, takenDate: true, createdAt: true },
    }),
  ]);

  const counts = statusCounts(tasks);
  const cover = photoIds.map((id) => coverPhotos.find((p) => p.id === id)).filter(Boolean) as typeof coverPhotos;

  // PCO aggregates
  const active = pcos.filter((p) => p.status !== "Voided");
  const activeValue = sumVal(active);
  const approved = pcos.filter((p) => p.status === "Approved");
  const pending = pcos.filter((p) => p.status === "Pending");
  const rom = pcos.filter((p) => p.status === "ROM");
  const originalContract = fin?.originalBudget ?? 0;
  const currentContract = originalContract + sumVal(approved);
  const potentialContract = currentContract + sumVal(pending) + sumVal(rom);
  const allowanceBalance = allowances.reduce((a, x) => a + x.balance, 0);

  const gantt = milestones.map((m) => ({
    description: m.description,
    baseDate: m.baseDate ? m.baseDate.toISOString() : null,
    currentDate: m.currentDate ? m.currentDate.toISOString() : null,
  }));

  const budget = fin?.currentBudget ?? 0;
  const spent = fin?.costsToDate ?? 0;
  const overBudget = (fin?.overUnderBeforeContingency ?? 0) > 0;

  const photoDate = (p: { takenDate: Date | null; createdAt: Date }) =>
    p.takenDate ? fullDate(p.takenDate) : fullDate(p.createdAt);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <PrintTrigger />

      <div className="mx-auto max-w-[8in] px-6 py-6 print:px-0 print:py-0">
        {/* ================= PAGE 1 — PROJECT DASHBOARD ================= */}
        <section>
          <ReportHeader project={project} fin={fin} title="Project Dashboard" />

          {/* KPI row */}
          <div className="mt-4 grid grid-cols-5 gap-2 avoid-break">
            <Kpi label="Total Tasks" value={String(tasks.length)} />
            <Kpi label="On Track" value={String(counts["On Track"])} dot="#16a34a" />
            <Kpi label="Needs Attn." value={String(counts["Needs Attention"])} dot="#d97706" />
            <Kpi label="Blocked" value={String(counts["Blocked"])} dot="#dc2626" />
            <Kpi label="Done" value={String(counts["Done"])} dot="#0284c7" />
          </div>

          {/* Hard cost summary */}
          <div className="mt-3 grid grid-cols-3 gap-2 avoid-break sm:grid-cols-6">
            <Kpi label="Current Budget" value={money(budget, { compact: true })} />
            <Kpi label="Commitments" value={money(fin?.currentCommitments, { compact: true })} />
            <Kpi label="Costs to Date" value={money(spent, { compact: true })} />
            <Kpi label="Projected Final" value={money(fin?.projectedFinalCost, { compact: true })} />
            <Kpi label="Contingency" value={money(fin?.contingencyBalance, { compact: true })} />
            <Kpi label={overBudget ? "Over Budget" : "Under Budget"} value={money(fin?.overUnderBeforeContingency, { compact: true })} />
          </div>

          {/* Gantt */}
          <div className="mt-5 avoid-break">
            <SectionLabel>Milestone Schedule</SectionLabel>
            <GanttSchedule milestones={gantt} light />
          </div>

          {/* Top issues */}
          <div className="mt-5 avoid-break">
            <SectionLabel>Top Issues</SectionLabel>
            <ul className="mt-1 space-y-1">
              {tasks.filter((t) => t.status === "Blocked" || t.status === "Needs Attention").slice(0, 6).map((t) => (
                <li key={t.id} className="flex justify-between border-b border-gray-100 py-1 text-sm">
                  <span>
                    <span className="font-medium">{t.title}</span>
                    <span className="text-gray-500"> — {t.workstream} · {t.lead ?? "Unassigned"}</span>
                  </span>
                  <span className="text-gray-600">{t.status}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Cover photos */}
          {cover.length > 0 && (
            <div className="mt-5 avoid-break">
              <SectionLabel>Progress Photos</SectionLabel>
              <div className="mt-1 grid grid-cols-3 gap-3">
                {cover.map((p) => (
                  <figure key={p.id} className="avoid-break">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/attachments/${p.id}`} alt={p.description ?? ""} className="h-[1.7in] w-full rounded border border-gray-200 object-cover" />
                    <figcaption className="mt-1 text-[10px] text-gray-600">
                      {photoDate(p)}{p.description ? ` — ${p.description}` : ""}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ================= PAGE 2 — CONSTRUCTION OVERVIEW ================= */}
        <section className="page-break pt-2">
          <SectionTitle>Construction Overview</SectionTitle>
          <div className="grid grid-cols-2 gap-6">
            <table className="w-full text-sm avoid-break">
              <tbody>
                {[
                  ["Original Budget (A)", money(fin?.originalBudget)],
                  ["Current Budget (D)", money(fin?.currentBudget)],
                  ["Current Commitments (H)", money(fin?.currentCommitments)],
                  ["Uncommitted Budget (I)", money(fin?.uncommittedBudget)],
                  ["Costs to Date (J)", money(fin?.costsToDate)],
                  ["Unspent Commitments (K)", money(fin?.unspentCommitments)],
                ].map(([k, v]) => (
                  <tr key={k} className="border-b border-gray-100">
                    <td className="py-1 text-gray-600">{k}</td>
                    <td className="py-1 text-right font-medium tabular-nums">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="w-full text-sm avoid-break">
              <tbody>
                {[
                  ["Projected Final Cost (P)", money(fin?.projectedFinalCost)],
                  ["Over / (Under) Budget", money(fin?.overUnderBeforeContingency)],
                  ["HC Contingency Balance (R)", money(fin?.contingencyBalance)],
                  ["Trending Contingency (S)", money(fin?.trendingContingencyAtCompletion)],
                  ["Contractor Contingency (T)", money(fin?.contractorContingency)],
                  ["Soft Cost Budget", money(fin?.softCostBudget)],
                ].map(([k, v]) => (
                  <tr key={k} className="border-b border-gray-100">
                    <td className="py-1 text-gray-600">{k}</td>
                    <td className="py-1 text-right font-medium tabular-nums">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <SectionLabel className="mt-6">Commitments</SectionLabel>
          <PrintTable
            head={["Vendor", "Contract", "Original", "COs", "Total", "Invoiced", "Remaining"]}
            aligns={["l", "l", "r", "r", "r", "r", "r"]}
            rows={commitments.map((c) => [
              c.vendor,
              c.contract ?? "—",
              money(c.originalContract, { compact: true }),
              money(c.changeOrderAmount, { compact: true }),
              money(c.totalContract, { compact: true }),
              money(c.invoiced, { compact: true }),
              money(c.remaining, { compact: true }),
            ])}
          />

          <SectionLabel className="mt-6">Milestones</SectionLabel>
          <PrintTable
            head={["Milestone", "Base", "Contract", "Current", "Variance"]}
            aligns={["l", "l", "l", "l", "r"]}
            rows={milestones.map((m) => [
              m.description,
              shortDate(m.baseDate),
              shortDate(m.contractDate),
              shortDate(m.currentDate),
              m.varianceDays == null ? "—" : m.varianceDays > 0 ? `+${m.varianceDays}d` : m.varianceDays < 0 ? `${m.varianceDays}d` : "on time",
            ])}
          />
        </section>

        {/* ================= PAGE 3 — COST TRACKING ================= */}
        <section className="page-break pt-2">
          <SectionTitle>Cost Tracking</SectionTitle>
          <div className="grid grid-cols-5 gap-2 avoid-break">
            <Kpi label="Total PCOs" value={String(pcos.length)} sub={money(sumVal(pcos), { compact: true })} />
            <Kpi label="Approved" value={String(approved.length)} sub={money(sumVal(approved), { compact: true })} dot={PCO_STATUS_COLOR.Approved} />
            <Kpi label="Pending" value={String(pending.length)} sub={money(sumVal(pending), { compact: true })} dot={PCO_STATUS_COLOR.Pending} />
            <Kpi label="ROM" value={String(rom.length)} sub={money(sumVal(rom), { compact: true })} dot={PCO_STATUS_COLOR.ROM} />
            <Kpi label="Active Value" value={money(activeValue, { compact: true })} />
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2 avoid-break">
            <Kpi label="Original Contract" value={money(originalContract, { compact: true })} />
            <Kpi label="Current Contract" value={money(currentContract, { compact: true })} />
            <Kpi label="Potential Contract" value={money(potentialContract, { compact: true })} />
            <Kpi label="Allowance Remaining" value={money(allowanceBalance, { compact: true })} />
          </div>

          <SectionLabel className="mt-6">Use of Allowances (Exhibit F)</SectionLabel>
          <PrintTable
            head={["Allowance", "Amount", "Used", "Balance", "PC Ref"]}
            aligns={["l", "r", "r", "r", "l"]}
            rows={allowances.map((a) => [a.name, money(a.amount), money(-a.used), money(a.balance), a.pcReference ?? "—"])}
          />

          <SectionLabel className="mt-6">Potential Change Order Log</SectionLabel>
          <PrintTable
            head={["#", "Scope", "Status", "Value", "Funding", "Reason"]}
            aligns={["l", "l", "l", "r", "l", "l"]}
            rows={pcos.map((p) => [p.number ?? "—", p.scope, p.status, money(p.value, { compact: true }), p.creFunding, p.reason])}
          />
        </section>

        {/* ================= PAGE 4 — TASKS ================= */}
        <section className="page-break pt-2">
          <SectionTitle>Tasks</SectionTitle>
          <PrintTable
            head={["Task", "Workstream", "Lead", "Status", "Priority", "Deadline"]}
            aligns={["l", "l", "l", "l", "l", "l"]}
            rows={tasks.map((t) => [
              t.title,
              t.workstream,
              t.lead ?? "—",
              t.status,
              t.priority,
              t.deadline ? shortDate(t.deadline) : "—",
            ])}
          />
        </section>

        {/* ================= PAGE 5 — LATEST PROGRESS PHOTOS (one page) ================= */}
        {latestPhotos.length > 0 && (
          <section className="page-break pt-2">
            <SectionTitle>Latest Progress Photos</SectionTitle>
            <div className="grid grid-cols-3 gap-3">
              {latestPhotos.map((p) => (
                <figure key={p.id} className="avoid-break">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/attachments/${p.id}`} alt={p.description ?? ""} className="h-[2.1in] w-full rounded border border-gray-200 object-cover" />
                  <figcaption className="mt-1 text-[10px] text-gray-600">
                    {photoDate(p)}{p.description ? ` — ${p.description}` : ""}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        <p className="no-print mt-8 text-center text-xs text-gray-400">
          Generated {fullDate(new Date())} · {project.name}
        </p>
      </div>
    </div>
  );
}

/* ---------- print helpers ---------- */
function ReportHeader({ project, fin, title }: { project: { name: string; code: string | null }; fin: { asOfDate: Date | null } | null; title: string }) {
  return (
    <div className="flex items-end justify-between border-b-2 border-gray-900 pb-2">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">{title}</div>
        <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
        <div className="text-xs text-gray-500">Project #{project.code ?? "—"}{fin?.asOfDate ? ` · As of ${fullDate(fin.asOfDate)}` : ""}</div>
      </div>
      <div className="text-right text-[11px] text-gray-500">Pulse · Status Hub</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 border-b-2 border-gray-900 pb-1 text-lg font-bold text-gray-900">{children}</h2>;
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`text-[11px] font-semibold uppercase tracking-wider text-gray-500 ${className ?? ""}`}>{children}</div>;
}

function Kpi({ label, value, sub, dot }: { label: string; value: string; sub?: string; dot?: string }) {
  return (
    <div className="rounded border border-gray-200 px-2 py-1.5 avoid-break">
      <div className="flex items-center gap-1 text-[9px] font-medium uppercase tracking-wide text-gray-500">
        {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />}
        {label}
      </div>
      <div className="text-base font-bold tabular-nums text-gray-900">{value}</div>
      {sub && <div className="text-[10px] text-gray-500">{sub}</div>}
    </div>
  );
}

function PrintTable({ head, rows, aligns }: { head: string[]; rows: (string | number)[][]; aligns: ("l" | "r")[] }) {
  return (
    <table className="mt-1 w-full border-collapse text-[11px]">
      <thead>
        <tr className="border-b border-gray-400 text-[9px] uppercase tracking-wide text-gray-500">
          {head.map((h, i) => (
            <th key={i} className={`py-1 font-semibold ${aligns[i] === "r" ? "text-right" : "text-left"}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="avoid-break border-b border-gray-100">
            {r.map((cell, j) => (
              <td key={j} className={`py-1 pr-2 ${aligns[j] === "r" ? "text-right tabular-nums" : "text-left"} ${j === 0 ? "font-medium text-gray-900" : "text-gray-700"}`}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

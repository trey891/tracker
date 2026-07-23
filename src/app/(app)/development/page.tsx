import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { statusCounts, healthScore } from "@/lib/data";
import { Topbar } from "@/components/Topbar";
import { StatCard } from "@/components/StatCard";
import { ProjectLink } from "@/components/ProjectLink";
import { StatusBadge } from "@/components/Badges";
import { EmptyState } from "@/components/EmptyState";
import { ScrollX } from "@/components/ScrollX";
import { money, pct, fullDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DevelopmentDashboard() {
  const session = await auth();
  const projects = await prisma.project.findMany({ orderBy: { createdAt: "asc" } });

  if (projects.length === 0) {
    return (
      <>
        <Topbar title="Development Dashboard" subtitle="Executive portfolio review" user={session?.user ?? {}} />
        <EmptyState title="No projects yet" hint="Create a project from the switcher in the sidebar to begin building the portfolio." />
      </>
    );
  }

  // Roll up each project: latest financials, task health, PCO exposure, next milestone.
  const rows = await Promise.all(
    projects.map(async (p) => {
      const [fin, tasks, pendingPcoAgg, nextMilestone] = await Promise.all([
        prisma.financialSnapshot.findFirst({ where: { projectId: p.id }, orderBy: { asOfDate: "desc" } }),
        prisma.task.findMany({ where: { projectId: p.id }, select: { status: true } }),
        prisma.pco.aggregate({
          where: { projectId: p.id, status: { in: ["Pending", "ROM"] } },
          _sum: { value: true },
          _count: true,
        }),
        prisma.milestone.findFirst({
          where: { projectId: p.id, currentDate: { gte: new Date() } },
          orderBy: { currentDate: "asc" },
        }),
      ]);
      const counts = statusCounts(tasks);
      return { p, fin, counts, tasks: tasks.length, pendingPco: pendingPcoAgg, nextMilestone, health: healthScore(counts) };
    }),
  );

  // Portfolio totals
  const sum = (fn: (r: (typeof rows)[number]) => number | null | undefined) =>
    rows.reduce((a, r) => a + (fn(r) ?? 0), 0);
  const totalBudget = sum((r) => r.fin?.currentBudget);
  const totalSpent = sum((r) => r.fin?.costsToDate);
  const totalProjected = sum((r) => r.fin?.projectedFinalCost);
  const totalContingency = sum((r) => r.fin?.contingencyBalance);
  const totalOverUnder = sum((r) => r.fin?.overUnderBeforeContingency);
  const projectsOverBudget = rows.filter((r) => (r.fin?.overUnderBeforeContingency ?? 0) > 0).length;

  // Upcoming milestones across the portfolio
  const upcoming = rows
    .filter((r) => r.nextMilestone)
    .map((r) => ({ project: r.p.name, m: r.nextMilestone! }))
    .sort((a, b) => (a.m.currentDate!.getTime() ?? 0) - (b.m.currentDate!.getTime() ?? 0))
    .slice(0, 6);

  return (
    <>
      <Topbar
        title="Development Dashboard"
        subtitle="Executive portfolio review — financials, schedule & status across all projects"
        user={session?.user ?? {}}
      />

      {/* Portfolio KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-6">
        <StatCard label="Projects" value={String(projects.length)} tone="brand" />
        <StatCard label="Portfolio Budget" value={money(totalBudget, { compact: true })} />
        <StatCard label="Costs to Date" value={money(totalSpent, { compact: true })} tone="ontrack" />
        <StatCard label="Projected Final" value={money(totalProjected, { compact: true })} tone={totalOverUnder > 0 ? "blocked" : "neutral"} />
        <StatCard label="Contingency" value={money(totalContingency, { compact: true })} tone="ontrack" />
        <StatCard
          label="Over / (Under)"
          value={money(totalOverUnder, { compact: true })}
          tone={totalOverUnder > 0 ? "blocked" : "ontrack"}
          delta={{ text: `${projectsOverBudget} of ${projects.length} over budget`, up: totalOverUnder <= 0 }}
        />
      </div>

      {/* Projects rollup */}
      <section className="card mt-4">
        <div className="px-5 py-4">
          <span className="eyebrow">Portfolio</span>
          <h2 className="mt-1 text-lg font-semibold text-white">Projects</h2>
        </div>
        <ScrollX>
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr className="border-y border-line text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-medium">Project</th>
                <th className="px-4 py-3 text-right font-medium">Budget</th>
                <th className="px-4 py-3 font-medium">Spent</th>
                <th className="px-4 py-3 text-right font-medium">Projected</th>
                <th className="px-4 py-3 text-right font-medium">Variance</th>
                <th className="px-4 py-3 text-right font-medium">Contingency</th>
                <th className="px-4 py-3 font-medium">Task health</th>
                <th className="px-4 py-3 text-right font-medium">Open PCOs</th>
                <th className="px-4 py-3 font-medium">Next milestone</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const budget = r.fin?.currentBudget ?? 0;
                const spent = r.fin?.costsToDate ?? 0;
                const util = budget ? spent / budget : 0;
                const variance = r.fin?.overUnderBeforeContingency ?? 0;
                return (
                  <tr key={r.p.id} className="border-b border-line/50 hover:bg-panel-2/40">
                    <td className="px-5 py-3">
                      <ProjectLink projectId={r.p.id} className="text-left font-medium text-white hover:text-brand-soft">
                        {r.p.name}
                        <span className="block text-[11px] font-normal text-slate-500">#{r.p.code ?? "—"}</span>
                      </ProjectLink>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">{money(budget, { compact: true })}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-panel-2">
                          <div className="h-full bg-status-done" style={{ width: `${Math.min(100, util * 100).toFixed(0)}%` }} />
                        </div>
                        <span className="text-xs text-slate-400">{pct(util, 0)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">{money(r.fin?.projectedFinalCost, { compact: true })}</td>
                    <td className={`px-4 py-3 text-right font-medium ${variance > 0 ? "text-status-blocked" : "text-status-ontrack"}`}>
                      {variance > 0 ? "+" : ""}
                      {money(variance, { compact: true })}
                    </td>
                    <td className="px-4 py-3 text-right text-status-ontrack">{money(r.fin?.contingencyBalance, { compact: true })}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="rounded bg-status-ontrack/10 px-1.5 py-0.5 text-status-ontrack">{r.counts["On Track"]}</span>
                        <span className="rounded bg-status-attention/10 px-1.5 py-0.5 text-status-attention">{r.counts["Needs Attention"]}</span>
                        <span className="rounded bg-status-blocked/10 px-1.5 py-0.5 text-status-blocked">{r.counts["Blocked"]}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      {money(r.pendingPco._sum.value, { compact: true })}
                      <span className="ml-1 text-[11px] text-slate-500">({r.pendingPco._count})</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {r.nextMilestone ? (
                        <>
                          <span className="text-slate-300">{r.nextMilestone.description}</span>
                          <span className="block text-[11px] text-slate-500">{fullDate(r.nextMilestone.currentDate)}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollX>
      </section>

      {/* Schedule rollup */}
      <section className="card card-pad mt-4">
        <span className="eyebrow">Schedule</span>
        <h2 className="mb-4 mt-1 text-lg font-semibold text-white">Upcoming milestones across the portfolio</h2>
        {upcoming.length > 0 ? (
          <ul className="space-y-2">
            {upcoming.map((u, i) => (
              <li key={i} className="flex items-center justify-between border-b border-line/50 py-2 last:border-0">
                <div>
                  <div className="text-sm font-medium text-white">{u.m.description}</div>
                  <div className="text-xs text-slate-500">{u.project}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-300">{fullDate(u.m.currentDate)}</div>
                  {u.m.varianceDays != null && u.m.varianceDays !== 0 && (
                    <div className={`text-[11px] ${u.m.varianceDays > 0 ? "text-status-blocked" : "text-status-ontrack"}`}>
                      {u.m.varianceDays > 0 ? `+${u.m.varianceDays}d` : `${u.m.varianceDays}d`} vs contract
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No upcoming milestones scheduled.</p>
        )}
      </section>
    </>
  );
}

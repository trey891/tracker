import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getPrimaryProject,
  getLatestFinancials,
  getTasks,
  statusCounts,
} from "@/lib/data";
import { Topbar } from "@/components/Topbar";
import { StatCard } from "@/components/StatCard";
import { StackedStatusChart, Donut } from "@/components/Charts";
import { StatusBadge, PriorityBadge, WorkstreamTag } from "@/components/Badges";
import { NoProject } from "@/components/EmptyState";
import { money, pct, dueLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  const project = await getPrimaryProject();
  if (!project) {
    return (
      <>
        <Topbar title="Dashboard" subtitle="At-a-glance health across every workstream" user={session?.user ?? {}} />
        <NoProject />
      </>
    );
  }

  const [fin, tasks, weekly, teamCount] = await Promise.all([
    getLatestFinancials(project.id),
    getTasks(project.id),
    prisma.weeklyStatus.findMany({ where: { projectId: project.id }, orderBy: { orderIndex: "asc" } }),
    prisma.user.count(),
  ]);

  const counts = statusCounts(tasks);
  const total = tasks.length;
  const topIssues = tasks.filter((t) => t.status === "Blocked" || t.status === "Needs Attention").slice(0, 5);
  const recent = [...tasks].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, 4);

  const sparks = {
    total: weekly.map((w) => w.onTrack + w.needsAttention + w.blocked + w.done),
    onTrack: weekly.map((w) => w.onTrack),
    attention: weekly.map((w) => w.needsAttention),
    blocked: weekly.map((w) => w.blocked),
  };

  const budget = fin?.currentBudget ?? 0;
  const spent = fin?.costsToDate ?? 0;
  const committedUnspent = fin?.unspentCommitments ?? 0;
  const uncommitted = fin?.uncommittedBudget ?? 0;
  const utilization = budget ? spent / budget : 0;
  const overBudget = (fin?.overUnderBeforeContingency ?? 0) > 0;

  return (
    <>
      <Topbar
        title="Dashboard"
        subtitle="At-a-glance health across every workstream"
        user={session?.user ?? {}}
        action={
          <Link href="/tasks?new=1" className="btn-primary">
            + New Task
          </Link>
        }
      />

      <p className="mb-5 text-sm text-slate-400">
        <span className="font-semibold text-slate-200">{teamCount} teammates</span> · {total} tasks this cycle ·{" "}
        <span className="text-slate-300">{project.name}</span>
      </p>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Tasks" value={String(total)} tone="brand" spark={sparks.total} />
        <StatCard label="On Track" value={String(counts["On Track"])} tone="ontrack" spark={sparks.onTrack} />
        <StatCard label="Needs Attention" value={String(counts["Needs Attention"])} tone="attention" spark={sparks.attention} />
        <StatCard label="Blocked" value={String(counts["Blocked"])} tone="blocked" spark={sparks.blocked} />
      </div>

      {/* Trend + Top issues */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="card card-pad lg:col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="eyebrow">Status trend</span>
            <span className="text-xs text-slate-500">Last {weekly.length} weeks</span>
          </div>
          <h2 className="mb-4 text-lg font-semibold text-white">Weekly status mix</h2>
          {weekly.length > 0 ? (
            <StackedStatusChart weeks={weekly} />
          ) : (
            <p className="text-sm text-slate-500">No trend data.</p>
          )}
        </section>

        <section className="card card-pad">
          <span className="eyebrow">Top issues</span>
          <h2 className="mb-4 text-lg font-semibold text-white">Needs your attention</h2>
          <ul className="space-y-3">
            {topIssues.map((t) => (
              <li key={t.id} className="border-b border-line/60 pb-3 last:border-0 last:pb-0">
                <div className="flex items-start gap-2">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${t.status === "Blocked" ? "bg-status-blocked" : "bg-status-attention"}`} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">{t.title}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {t.workstream} · {t.lead ?? "Unassigned"}
                    </div>
                    {t.blocker && <div className="mt-1 text-xs text-status-attention">⚠ {t.blocker}</div>}
                  </div>
                </div>
              </li>
            ))}
            {topIssues.length === 0 && <li className="text-sm text-slate-500">Nothing flagged. 🎉</li>}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/tasks?status=Blocked" className="pill text-status-blocked bg-status-blocked/10 ring-status-blocked/30">
              All blocked ({counts.Blocked})
            </Link>
            <Link href="/tasks?status=Needs+Attention" className="pill text-status-attention bg-status-attention/10 ring-status-attention/30">
              All needing attention ({counts["Needs Attention"]})
            </Link>
          </div>
        </section>
      </div>

      {/* Hard cost projections */}
      <section className="card card-pad mt-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="eyebrow">Hard cost projections</span>
            <h2 className="mt-1 text-lg font-semibold text-white">
              {project.name}{" "}
              <Link href="/hard-cost" className="text-sm font-normal text-brand-soft hover:underline">
                View full detail →
              </Link>
            </h2>
            <p className="text-xs text-slate-500">
              Project #{project.code} · As of {fin?.asOfDate?.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) ?? "—"}
            </p>
          </div>
          <span
            className={`pill ${overBudget ? "text-status-blocked bg-status-blocked/10 ring-status-blocked/30" : "text-status-ontrack bg-status-ontrack/10 ring-status-ontrack/30"}`}
          >
            {overBudget
              ? `Trending over budget by ${money(fin?.overUnderBeforeContingency, { compact: true })}`
              : "On budget"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <MiniStat label="Current Budget" value={money(budget, { compact: true })} sub={`Orig ${money(fin?.originalBudget, { compact: true })}`} accent="text-brand-soft" />
          <MiniStat label="Commitments" value={money(fin?.currentCommitments, { compact: true })} sub={`${pct(budget ? (fin?.currentCommitments ?? 0) / budget : 0)} of budget`} />
          <MiniStat label="Costs to Date" value={money(spent, { compact: true })} sub={`${pct(utilization)} spent`} />
          <MiniStat label="Projected Final" value={money(fin?.projectedFinalCost, { compact: true })} sub={overBudget ? `${money(fin?.overUnderBeforeContingency, { compact: true })} over` : "within budget"} accent="text-status-blocked" />
          <MiniStat label="Contingency Balance" value={money(fin?.contingencyBalance, { compact: true })} sub={`Contractor ${money(fin?.contractorContingency, { compact: true })}`} accent="text-status-ontrack" />
          <MiniStat label="Trending @ Completion" value={money(fin?.trendingContingencyAtCompletion, { compact: true })} sub="Contingency remaining" accent="text-status-ontrack" />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-slate-400">Current budget utilization</span>
              <span className="font-semibold text-white">{pct(utilization)} spent of {money(budget, { compact: true })}</span>
            </div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-panel-2">
              <div className="bg-status-done" style={{ width: `${(utilization * 100).toFixed(1)}%` }} />
              <div className="bg-status-ontrack" style={{ width: `${(budget ? (committedUnspent / budget) * 100 : 0).toFixed(1)}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <UtilLeg color="bg-status-done" label="Spent" value={money(spent, { compact: true })} share={pct(utilization)} />
              <UtilLeg color="bg-status-ontrack" label="Committed (unspent)" value={money(committedUnspent, { compact: true })} share={pct(budget ? committedUnspent / budget : 0)} />
              <UtilLeg color="bg-slate-600" label="Uncommitted" value={money(uncommitted, { compact: true })} share={pct(budget ? uncommitted / budget : 0)} />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ChangeStat label="PCOs approved" value={money(fin?.pcosApprovedPendingCo, { compact: true })} qty={fin?.pcosApprovedPendingCoQty} />
              <ChangeStat label="PCOs pending" value={money(fin?.pcosPending, { compact: true })} qty={fin?.pcosPendingQty} accent="text-status-attention" />
              <ChangeStat label="COs approved" value={money(fin?.cosApproved, { compact: true })} qty={fin?.cosApprovedQty} />
              <ChangeStat label="Uncommitted" value={money(uncommitted, { compact: true })} qty={undefined} sub="remaining" />
            </div>
          </div>

          <div className="card border-line bg-panel-2/50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="eyebrow">Owner allowance</span>
            </div>
            <Donut
              size={150}
              thickness={22}
              centerValue={money((fin?.ffeAllowance ?? 0) + (fin?.allowances ?? 0), { compact: true })}
              centerLabel="Allowance"
              segments={[
                { label: "Committed", value: Math.round((fin?.ffeAllowance ?? 0) / 1000), color: "#22c55e" },
                { label: "Forecast", value: Math.round((fin?.allowances ?? 0) / 1000), color: "#f59e0b" },
              ]}
            />
          </div>
        </div>
      </section>

      {/* Recent activity */}
      <section className="mt-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Recent activity</h2>
          <Link href="/tasks" className="text-sm text-brand-soft hover:underline">
            See all tasks →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {recent.map((t) => {
            const due = dueLabel(t.deadline);
            return (
              <div key={t.id} className="card card-pad">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold text-white">{t.title}</span>
                  <StatusBadge status={t.status} />
                  <PriorityBadge priority={t.priority} />
                  <WorkstreamTag name={t.workstream} />
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {t.lead ?? "Unassigned"}
                  {due && (
                    <>
                      {" · "}
                      <span className={due.overdue ? "text-status-blocked" : "text-slate-400"}>{due.text}</span>
                    </>
                  )}
                </div>
                {t.note && <p className="mt-2 text-sm text-slate-400">{t.note}</p>}
                {t.blocker && (
                  <div className="mt-2 rounded-lg bg-status-blocked/10 px-3 py-2 text-sm text-status-blocked ring-1 ring-status-blocked/20">
                    ⚠ Blocker: {t.blocker}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

function MiniStat({ label, value, sub, accent = "text-white" }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel-2/40 p-3">
      <div className="eyebrow">{label}</div>
      <div className={`mt-1.5 text-xl font-semibold ${accent}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

function UtilLeg({ color, label, value, share }: { color: string; label: string; value: string; share: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel-2/40 p-2.5">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span className={`h-2 w-2 rounded-full ${color}`} />
        {label}
      </div>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="text-sm font-semibold text-white">{value}</span>
        <span className="text-[11px] text-slate-500">{share}</span>
      </div>
    </div>
  );
}

function ChangeStat({ label, value, qty, sub, accent = "text-white" }: { label: string; value: string; qty?: number | null; sub?: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel-2/40 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${accent}`}>
        {value} {qty != null && <span className="text-xs font-normal text-slate-500">({qty})</span>}
      </div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

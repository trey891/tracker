import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getPrimaryProject,
  getTasks,
  statusCounts,
  workstreamBreakdown,
  priorityCounts,
  healthScore,
} from "@/lib/data";
import { Topbar } from "@/components/Topbar";
import { NoProject } from "@/components/EmptyState";
import { StackedStatusChart, WorkstreamBars, Donut } from "@/components/Charts";
import { PRIORITY_COLOR } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const session = await auth();
  const project = await getPrimaryProject();
  if (!project) {
    return (
      <>
        <Topbar title="Analytics" subtitle="Deeper insight into status, priority & trends" user={session?.user ?? {}} />
        <NoProject />
      </>
    );
  }

  const [tasks, weekly] = await Promise.all([
    getTasks(project.id),
    prisma.weeklyStatus.findMany({ where: { projectId: project.id }, orderBy: { orderIndex: "asc" } }),
  ]);

  const counts = statusCounts(tasks);
  const total = tasks.length || 1;
  const health = healthScore(counts);
  const wsRows = workstreamBreakdown(tasks);
  const prio = priorityCounts(tasks);

  const healthCards = [
    { label: "On Track", n: counts["On Track"], color: "#22c55e" },
    { label: "Needs Attention", n: counts["Needs Attention"], color: "#f59e0b" },
    { label: "Blocked", n: counts["Blocked"], color: "#ef4444" },
    { label: "Done", n: counts["Done"], color: "#38bdf8" },
  ];

  return (
    <>
      <Topbar title="Analytics" subtitle="Deeper insight into status, priority & trends" user={session?.user ?? {}} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Trend */}
        <section className="card card-pad lg:col-span-2">
          <div className="flex items-center justify-between">
            <span className="eyebrow">Trend</span>
            <span className="text-xs text-slate-500">Stacked, last {weekly.length} weeks</span>
          </div>
          <h2 className="mb-4 mt-1 text-lg font-semibold text-white">Status over time</h2>
          {weekly.length > 0 ? <StackedStatusChart weeks={weekly} /> : <p className="text-sm text-slate-500">No trend data.</p>}
        </section>

        {/* Health score */}
        <section className="card card-pad">
          <span className="eyebrow">Overall</span>
          <h2 className="mt-1 text-lg font-semibold text-white">Health score</h2>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-5xl font-semibold text-white">{health}</span>
            <span className="text-slate-500">/ 100</span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full" style={{ background: "linear-gradient(90deg,#ef4444,#f59e0b,#22c55e)" }}>
            <div className="h-full bg-canvas/0" style={{ width: `${100 - health}%`, marginLeft: `${health}%`, background: "rgba(10,11,15,0.75)" }} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {healthCards.map((c) => (
              <div key={c.label} className="rounded-lg border border-line bg-panel-2/40 p-3">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                  {c.label}
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-xl font-semibold text-white">{c.n}</span>
                  <span className="text-[11px] text-slate-500">{Math.round((c.n / total) * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Workstream breakdown */}
        <section className="card card-pad lg:col-span-2">
          <span className="eyebrow">Breakdown</span>
          <h2 className="mb-4 mt-1 text-lg font-semibold text-white">Status by workstream</h2>
          {wsRows.length > 0 ? <WorkstreamBars rows={wsRows} /> : <p className="text-sm text-slate-500">No tasks yet.</p>}
        </section>

        {/* Priority distribution */}
        <section className="card card-pad">
          <span className="eyebrow">Mix</span>
          <h2 className="mb-4 mt-1 text-lg font-semibold text-white">Priority distribution</h2>
          <Donut
            size={170}
            centerValue={String(tasks.length)}
            centerLabel="Tasks"
            segments={[
              { label: "Critical", value: prio.Critical, color: PRIORITY_COLOR.Critical },
              { label: "High", value: prio.High, color: PRIORITY_COLOR.High },
              { label: "Medium", value: prio.Medium, color: PRIORITY_COLOR.Medium },
              { label: "Low", value: prio.Low, color: PRIORITY_COLOR.Low },
            ].filter((s) => s.value > 0)}
          />
        </section>
      </div>
    </>
  );
}

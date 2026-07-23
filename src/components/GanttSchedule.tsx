// Simple milestone Gantt: one bar per milestone spanning from the schedule
// start to its CURRENT date, labeled with that date and the variance in days
// from the BASE date. Works on the dark app and the light PDF report (`light`).

type M = {
  description: string;
  baseDate: string | Date | null;
  currentDate: string | Date | null;
};

function toDate(d: string | Date | null): Date | null {
  if (!d) return null;
  const dt = typeof d === "string" ? new Date(d) : d;
  return Number.isNaN(dt.getTime()) ? null : dt;
}

const DAY = 86400000;

export function GanttSchedule({ milestones, light = false }: { milestones: M[]; light?: boolean }) {
  const rows = milestones
    .map((m) => ({ description: m.description, base: toDate(m.baseDate), current: toDate(m.currentDate) }))
    .filter((r) => r.current);

  if (rows.length === 0) {
    return <p className={light ? "text-sm text-gray-500" : "text-sm text-slate-500"}>No scheduled milestones.</p>;
  }

  const dates = rows.map((r) => r.current!.getTime());
  const min = Math.min(...dates, ...rows.map((r) => (r.base ? r.base.getTime() : Infinity)).filter((n) => Number.isFinite(n)));
  const max = Math.max(...dates);
  const span = Math.max(1, max - min);

  // year gridlines
  const startYear = new Date(min).getFullYear();
  const endYear = new Date(max).getFullYear();
  const yearTicks: { year: number; pct: number }[] = [];
  for (let y = startYear; y <= endYear + 1; y++) {
    const t = new Date(y, 0, 1).getTime();
    if (t < min || t > max) continue;
    yearTicks.push({ year: y, pct: ((t - min) / span) * 100 });
  }

  const c = light
    ? { label: "text-gray-800", track: "#eef0f5", bar: "#6d5cff", dot: "#4c3fd6", date: "text-gray-700", grid: "#e5e7eb", pos: "text-emerald-600", neg: "text-rose-600", muted: "text-gray-400" }
    : { label: "text-white", track: "#171a24", bar: "#7c5cff", dot: "#a48bff", date: "text-slate-300", grid: "#232734", pos: "text-status-ontrack", neg: "text-status-blocked", muted: "text-slate-500" };

  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });

  return (
    <div className="w-full">
      <div className="flex">
        <div className="w-40 shrink-0 sm:w-52" />
        <div className="relative h-4 flex-1">
          {yearTicks.map((t) => (
            <div key={t.year} className={`absolute top-0 text-[10px] ${c.muted}`} style={{ left: `${t.pct}%` }}>
              {t.year}
            </div>
          ))}
        </div>
        <div className="w-28 shrink-0" />
      </div>

      <div className="space-y-1.5">
        {rows.map((r, i) => {
          const pct = ((r.current!.getTime() - min) / span) * 100;
          const varDays = r.base ? Math.round((r.current!.getTime() - r.base.getTime()) / DAY) : null;
          return (
            <div key={i} className="flex items-center">
              <div className={`w-40 shrink-0 truncate pr-2 text-xs font-medium sm:w-52 ${c.label}`} title={r.description}>
                {r.description}
              </div>
              <div className="relative h-5 flex-1">
                {/* gridlines */}
                {yearTicks.map((t) => (
                  <div key={t.year} className="absolute top-0 h-full" style={{ left: `${t.pct}%`, borderLeft: `1px solid ${c.grid}` }} />
                ))}
                {/* bar from start to current */}
                <div
                  className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
                  style={{ left: 0, width: `${Math.max(1.5, pct)}%`, background: c.bar, opacity: 0.85 }}
                />
                {/* milestone marker */}
                <div
                  className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{ left: `${pct}%`, background: c.dot, border: `1px solid ${light ? "#fff" : "#0a0b0f"}` }}
                />
              </div>
              <div className="w-28 shrink-0 pl-2 text-right">
                <span className={`text-[11px] tabular-nums ${c.date}`}>{fmt(r.current!)}</span>
                {varDays != null && (
                  <span className={`ml-1 text-[10px] tabular-nums ${varDays > 0 ? c.neg : varDays < 0 ? c.pos : c.muted}`}>
                    {varDays === 0 ? "±0" : varDays > 0 ? `+${varDays}d` : `${varDays}d`}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className={`mt-2 text-[10px] ${c.muted}`}>Bars run to each milestone&rsquo;s current date; variance shown vs. baseline.</div>
    </div>
  );
}

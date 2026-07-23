// Simple milestone Gantt: one bar per milestone spanning from the schedule
// start to its CURRENT date, labeled with that date and the variance in days
// from the BASE date. Renders on the dark app and the light PDF (`light`).
// `markerDate` draws a vertical reference line (e.g., the publish date).

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

export function GanttSchedule({
  milestones,
  light = false,
  markerDate,
  markerLabel = "Today",
}: {
  milestones: M[];
  light?: boolean;
  markerDate?: string | Date | null;
  markerLabel?: string;
}) {
  const rows = milestones
    .map((m) => ({ description: m.description, base: toDate(m.baseDate), current: toDate(m.currentDate) }))
    .filter((r) => r.current);

  if (rows.length === 0) {
    return <p className={light ? "text-sm text-gray-500" : "text-sm text-slate-500"}>No scheduled milestones.</p>;
  }

  const marker = toDate(markerDate ?? null);
  const dateVals = [
    ...rows.map((r) => r.current!.getTime()),
    ...rows.map((r) => (r.base ? r.base.getTime() : NaN)).filter((n) => !Number.isNaN(n)),
    ...(marker ? [marker.getTime()] : []),
  ];
  const min = Math.min(...dateVals);
  const max = Math.max(...dateVals);
  const span = Math.max(1, max - min);
  const posOf = (t: number) => ((t - min) / span) * 100;

  // Quarter gridlines with month labels (Jan/Apr/Jul/Oct); year shown on Jan.
  const ticks: { label: string; year?: number; pct: number }[] = [];
  const start = new Date(min);
  let y = start.getFullYear();
  let mo = Math.floor(start.getMonth() / 3) * 3;
  while (true) {
    const t = new Date(y, mo, 1).getTime();
    if (t > max) break;
    if (t >= min) {
      ticks.push({
        label: new Date(y, mo, 1).toLocaleDateString("en-US", { month: "short" }),
        year: mo === 0 ? y : undefined,
        pct: posOf(t),
      });
    }
    mo += 3;
    if (mo > 11) {
      mo = 0;
      y += 1;
    }
  }

  const c = light
    ? { label: "text-gray-800", bar: "#6d5cff", dot: "#4c3fd6", date: "text-gray-700", grid: "#e5e7eb", tick: "text-gray-500", pos: "text-emerald-600", neg: "text-rose-600", muted: "text-gray-400", marker: "#dc2626", ring: "#fff" }
    : { label: "text-white", bar: "#7c5cff", dot: "#a48bff", date: "text-slate-300", grid: "#232734", tick: "text-slate-500", pos: "text-status-ontrack", neg: "text-status-blocked", muted: "text-slate-500", marker: "#f87171", ring: "#0a0b0f" };

  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
  const markerPct = marker ? posOf(marker.getTime()) : null;

  const Overlay = (
    <>
      {ticks.map((t, i) => (
        <div key={i} className="absolute top-0 h-full" style={{ left: `${t.pct}%`, borderLeft: `1px solid ${c.grid}` }} />
      ))}
      {markerPct != null && (
        <div className="absolute top-0 h-full" style={{ left: `${markerPct}%`, borderLeft: `1.5px dashed ${c.marker}` }} />
      )}
    </>
  );

  return (
    <div className="w-full" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" } as React.CSSProperties}>
      {/* Axis */}
      <div className="flex">
        <div className="w-36 shrink-0 sm:w-48" />
        <div className="relative h-4 flex-1">
          {ticks.map((t, i) => (
            <div key={i} className={`absolute top-0 whitespace-nowrap text-[9px] ${c.tick}`} style={{ left: `${t.pct}%` }}>
              {t.year ? `${t.label} '${String(t.year).slice(2)}` : t.label}
            </div>
          ))}
          {markerPct != null && (
            <div className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold" style={{ left: `${markerPct}%`, color: c.marker }}>
              {markerLabel}
            </div>
          )}
        </div>
        <div className="w-24 shrink-0" />
      </div>

      {/* Rows */}
      <div>
        {rows.map((r, i) => {
          const pct = posOf(r.current!.getTime());
          const varDays = r.base ? Math.round((r.current!.getTime() - r.base.getTime()) / DAY) : null;
          return (
            <div key={i} className="flex items-center">
              <div className={`w-36 shrink-0 truncate pr-2 text-[11px] font-medium sm:w-48 ${c.label}`} title={r.description}>
                {r.description}
              </div>
              <div className="relative h-4 flex-1">
                {Overlay}
                <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full" style={{ left: 0, width: `${Math.max(1.5, pct)}%`, background: c.bar }} />
                <div className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${pct}%`, background: c.dot, border: `1px solid ${c.ring}` }} />
              </div>
              <div className="w-24 shrink-0 pl-2 text-right">
                <span className={`text-[10px] tabular-nums ${c.date}`}>{fmt(r.current!)}</span>
                {varDays != null && (
                  <span className={`ml-1 text-[9px] tabular-nums ${varDays > 0 ? c.neg : varDays < 0 ? c.pos : c.muted}`}>
                    {varDays === 0 ? "±0" : varDays > 0 ? `+${varDays}d` : `${varDays}d`}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

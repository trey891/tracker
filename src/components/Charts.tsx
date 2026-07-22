import { STATUS_COLOR } from "@/lib/constants";

type Week = { week: string; onTrack: number; needsAttention: number; blocked: number; done: number };

const SEGMENTS = [
  { key: "onTrack", label: "On Track", color: STATUS_COLOR["On Track"] },
  { key: "needsAttention", label: "Needs Attention", color: STATUS_COLOR["Needs Attention"] },
  { key: "blocked", label: "Blocked", color: STATUS_COLOR["Blocked"] },
  { key: "done", label: "Done", color: STATUS_COLOR["Done"] },
] as const;

export function StackedStatusChart({ weeks }: { weeks: Week[] }) {
  const totals = weeks.map((w) => w.onTrack + w.needsAttention + w.blocked + w.done);
  const max = Math.max(25, ...totals);
  const step = 5;
  const ticks = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
  const H = 260;
  const barW = 46;

  return (
    <div>
      <div className="flex gap-4">
        {/* Y axis */}
        <div className="relative w-6 shrink-0" style={{ height: H }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2 text-[10px] text-slate-500" style={{ bottom: `${(t / max) * H}px` }}>
              {t}
            </span>
          ))}
        </div>
        {/* Plot */}
        <div className="relative flex-1">
          <div className="absolute inset-0">
            {ticks.map((t) => (
              <div key={t} className="absolute left-0 right-0 border-t border-line/60" style={{ bottom: `${(t / max) * H}px` }} />
            ))}
          </div>
          <div className="relative flex items-end justify-between" style={{ height: H }}>
            {weeks.map((w) => (
              <div key={w.week} className="flex flex-col items-center gap-2">
                <div className="flex flex-col-reverse overflow-hidden rounded-md" style={{ width: barW }}>
                  {SEGMENTS.map((s) => {
                    const v = w[s.key] as number;
                    if (!v) return null;
                    return <div key={s.key} title={`${s.label}: ${v}`} style={{ height: `${(v / max) * H}px`, background: s.color }} />;
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between">
            {weeks.map((w) => (
              <div key={w.week} className="text-center text-[11px] text-slate-500" style={{ width: barW }}>
                {w.week}
              </div>
            ))}
          </div>
        </div>
      </div>
      <Legend items={SEGMENTS.map((s) => ({ label: s.label, color: s.color }))} />
    </div>
  );
}

export function Donut({
  segments,
  centerValue,
  centerLabel,
  size = 190,
  thickness = 26,
}: {
  segments: { label: string; value: number; color: string }[];
  centerValue: string;
  centerLabel?: string;
  size?: number;
  thickness?: number;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#232734" strokeWidth={thickness} />
          {segments.map((s, i) => {
            const len = (s.value / total) * c;
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-white">{centerValue}</span>
          {centerLabel && <span className="text-[10px] uppercase tracking-wider text-slate-500">{centerLabel}</span>}
        </div>
      </div>
      <ul className="space-y-2 text-sm">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-2 text-slate-300">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="font-semibold text-white">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Grouped vertical bars for "status by workstream".
export function WorkstreamBars({
  rows,
}: {
  rows: { name: string; onTrack: number; needsAttention: number; blocked: number; done: number }[];
}) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.onTrack, r.needsAttention, r.blocked, r.done)));
  const H = 150;
  return (
    <div>
      <div className="flex items-end gap-6 overflow-x-auto pb-2" style={{ minHeight: H + 40 }}>
        {rows.map((r) => (
          <div key={r.name} className="flex shrink-0 flex-col items-center gap-2">
            <div className="flex items-end gap-1" style={{ height: H }}>
              {SEGMENTS.map((s) => {
                const v = r[s.key] as number;
                return (
                  <div
                    key={s.key}
                    title={`${s.label}: ${v}`}
                    className="w-2.5 rounded-t"
                    style={{ height: `${(v / max) * H}px`, background: v ? s.color : "transparent", minHeight: v ? 4 : 0 }}
                  />
                );
              })}
            </div>
            <span className="max-w-[84px] text-center text-[10px] leading-tight text-slate-500">{r.name}</span>
          </div>
        ))}
      </div>
      <Legend items={SEGMENTS.map((s) => ({ label: s.label, color: s.color }))} />
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-2 text-xs text-slate-400">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

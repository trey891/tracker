export function StatCard({
  label,
  value,
  delta,
  tone = "neutral",
  spark,
  icon,
}: {
  label: string;
  value: string;
  delta?: { text: string; up?: boolean };
  tone?: "neutral" | "ontrack" | "attention" | "blocked" | "brand";
  spark?: number[];
  icon?: React.ReactNode;
}) {
  const ring = {
    neutral: "border-line",
    ontrack: "border-status-ontrack/30",
    attention: "border-status-attention/30",
    blocked: "border-status-blocked/30",
    brand: "border-brand/40",
  }[tone];
  const stroke = {
    neutral: "#7c5cff",
    ontrack: "#22c55e",
    attention: "#f59e0b",
    blocked: "#ef4444",
    brand: "#7c5cff",
  }[tone];

  return (
    <div className={`card card-pad border ${ring}`}>
      <div className="flex items-center justify-between">
        <span className="eyebrow flex items-center gap-2">
          {icon}
          {label}
        </span>
        {spark && <Sparkline data={spark} color={stroke} />}
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-white">{value}</div>
      {delta && (
        <div className={`mt-1 text-xs ${delta.up ? "text-status-ontrack" : "text-slate-400"}`}>
          {delta.up ? "↗" : "↘"} {delta.text}
        </div>
      )}
    </div>
  );
}

export function Sparkline({ data, color = "#7c5cff", w = 88, h = 30 }: { data: number[]; color?: string; w?: number; h?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / span) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

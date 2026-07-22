import { STATUS_BADGE, PRIORITY_BADGE, type Status, type Priority, isStatus, isPriority } from "@/lib/constants";

export function StatusBadge({ status }: { status: string }) {
  const cls = isStatus(status) ? STATUS_BADGE[status as Status] : "text-slate-300 bg-slate-500/10 ring-slate-500/30";
  const dot = isStatus(status)
    ? { "On Track": "bg-status-ontrack", "Needs Attention": "bg-status-attention", Blocked: "bg-status-blocked", Done: "bg-status-done" }[status as Status]
    : "bg-slate-400";
  return (
    <span className={`pill ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const cls = isPriority(priority) ? PRIORITY_BADGE[priority as Priority] : "text-slate-300 bg-slate-500/10 ring-slate-500/30";
  return <span className={`pill ${cls}`}>{priority}</span>;
}

export function WorkstreamTag({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />
      </svg>
      {name}
    </span>
  );
}

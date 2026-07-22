// Controlled vocabularies shared by the UI, forms and validation.

export const STATUSES = ["On Track", "Needs Attention", "Blocked", "Done"] as const;
export type Status = (typeof STATUSES)[number];

export const PRIORITIES = ["Critical", "High", "Medium", "Low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const WORKSTREAMS = [
  "Construction",
  "Design",
  "Permitting",
  "Tenant Coordination",
  "FF&E",
  "Signage",
  "Property Management",
  "Budget & Finance",
  "Other",
] as const;
export type Workstream = (typeof WORKSTREAMS)[number];

// Tailwind-friendly hex for charts / inline styles.
export const STATUS_COLOR: Record<Status, string> = {
  "On Track": "#22c55e",
  "Needs Attention": "#f59e0b",
  Blocked: "#ef4444",
  Done: "#38bdf8",
};

export const PRIORITY_COLOR: Record<Priority, string> = {
  Critical: "#ef4444",
  High: "#f59e0b",
  Medium: "#3b82f6",
  Low: "#94a3b8",
};

// Badge classes (text + subtle background) for status pills.
export const STATUS_BADGE: Record<Status, string> = {
  "On Track": "text-status-ontrack bg-status-ontrack/10 ring-status-ontrack/30",
  "Needs Attention": "text-status-attention bg-status-attention/10 ring-status-attention/30",
  Blocked: "text-status-blocked bg-status-blocked/10 ring-status-blocked/30",
  Done: "text-status-done bg-status-done/10 ring-status-done/30",
};

export const PRIORITY_BADGE: Record<Priority, string> = {
  Critical: "text-status-blocked bg-status-blocked/10 ring-status-blocked/30",
  High: "text-status-attention bg-status-attention/10 ring-status-attention/30",
  Medium: "text-status-done bg-status-done/10 ring-status-done/30",
  Low: "text-slate-300 bg-slate-500/10 ring-slate-500/30",
};

export function isStatus(v: string): v is Status {
  return (STATUSES as readonly string[]).includes(v);
}
export function isPriority(v: string): v is Priority {
  return (PRIORITIES as readonly string[]).includes(v);
}
export function isWorkstream(v: string): v is Workstream {
  return (WORKSTREAMS as readonly string[]).includes(v);
}

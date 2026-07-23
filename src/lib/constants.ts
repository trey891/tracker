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

// ---- PCO (Cost Tracking) vocabularies ----
export const PCO_STATUSES = ["Approved", "Pending", "ROM", "Voided"] as const;
export const PCO_REASONS = ["Owner Change", "Tenant Request", "Design Error", "Other"] as const;
export const CRE_FUNDING = [
  "Owner Allowance",
  "TI Allowance",
  "FF&E",
  "GC Allowance",
  "Contractor Contingency",
  "PT&I",
  "None/Other",
] as const;
export const GC_FUNDING = ["CO to Contract", "GC Allowance", "Contractor Contingency", "None"] as const;

export const PCO_STATUS_COLOR: Record<string, string> = {
  Approved: "#22c55e",
  Pending: "#f59e0b",
  ROM: "#38bdf8",
  Voided: "#94a3b8",
};

// Subtle ring/badge classes for pill selects on the PCO log.
export const PCO_STATUS_BADGE: Record<string, string> = {
  Approved: "text-status-ontrack bg-status-ontrack/10 ring-status-ontrack/30",
  Pending: "text-status-attention bg-status-attention/10 ring-status-attention/30",
  ROM: "text-status-done bg-status-done/10 ring-status-done/30",
  Voided: "text-slate-400 bg-slate-500/10 ring-slate-500/30",
};

export const REASON_BADGE: Record<string, string> = {
  "Owner Change": "text-sky-300 bg-sky-500/10 ring-sky-500/30",
  "Tenant Request": "text-teal-300 bg-teal-500/10 ring-teal-500/30",
  "Design Error": "text-rose-300 bg-rose-500/10 ring-rose-500/30",
  Other: "text-slate-300 bg-slate-500/10 ring-slate-500/30",
};

export const FUNDING_BADGE: Record<string, string> = {
  "Owner Allowance": "text-violet-300 bg-violet-500/10 ring-violet-500/30",
  "TI Allowance": "text-amber-300 bg-amber-500/10 ring-amber-500/30",
  "FF&E": "text-pink-300 bg-pink-500/10 ring-pink-500/30",
  "GC Allowance": "text-emerald-300 bg-emerald-500/10 ring-emerald-500/30",
  "Contractor Contingency": "text-indigo-300 bg-indigo-500/10 ring-indigo-500/30",
  "PT&I": "text-cyan-300 bg-cyan-500/10 ring-cyan-500/30",
  "None/Other": "text-slate-300 bg-slate-500/10 ring-slate-500/30",
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

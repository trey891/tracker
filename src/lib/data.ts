import { prisma } from "@/lib/prisma";
import { STATUSES, WORKSTREAMS, type Status } from "@/lib/constants";

// The app is multi-project; for now we operate on the first (only) project.
// Swap this for a route param / project switcher when more are added.
export async function getPrimaryProject() {
  return prisma.project.findFirst({ orderBy: { createdAt: "asc" } });
}

export async function getPrimaryProjectId(): Promise<string | null> {
  const p = await prisma.project.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  return p?.id ?? null;
}

export async function getLatestFinancials(projectId: string) {
  return prisma.financialSnapshot.findFirst({
    where: { projectId },
    orderBy: { asOfDate: "desc" },
  });
}

export async function getTasks(projectId: string) {
  return prisma.task.findMany({
    where: { projectId },
    orderBy: [{ topIssue: "desc" }, { updatedAt: "desc" }],
  });
}

export function statusCounts(tasks: { status: string }[]): Record<Status, number> {
  const out = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  for (const t of tasks) if (t.status in out) out[t.status as Status]++;
  return out;
}

export function workstreamBreakdown(tasks: { workstream: string; status: string }[]) {
  const rows = WORKSTREAMS.map((name) => ({ name, onTrack: 0, needsAttention: 0, blocked: 0, done: 0 }));
  const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
  for (const t of tasks) {
    const r = byName[t.workstream];
    if (!r) continue;
    if (t.status === "On Track") r.onTrack++;
    else if (t.status === "Needs Attention") r.needsAttention++;
    else if (t.status === "Blocked") r.blocked++;
    else if (t.status === "Done") r.done++;
  }
  // only workstreams that have at least one task
  return rows.filter((r) => r.onTrack + r.needsAttention + r.blocked + r.done > 0);
}

export function priorityCounts(tasks: { priority: string }[]) {
  const out = { Critical: 0, High: 0, Medium: 0, Low: 0 } as Record<string, number>;
  for (const t of tasks) if (t.priority in out) out[t.priority]++;
  return out;
}

// A 0-100 project "health score": weighted mix of on-track share and how much
// contingency remains vs. what's trending. Purely a summary heuristic.
export function healthScore(counts: Record<Status, number>): number {
  const total = STATUSES.reduce((a, s) => a + counts[s], 0) || 1;
  const good = counts["On Track"] + counts["Done"];
  const bad = counts["Blocked"] * 2 + counts["Needs Attention"];
  const raw = ((good - bad) / total) * 50 + 55;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

import { prisma } from "@/lib/prisma";

// Storage / cost monitoring. The app stores everything — including progress
// photos and uploaded documents — as rows in Postgres, so the database size is
// the single figure that decides when you outgrow the free tier. We read it
// directly with pg_database_size and compare it against the hosted plan's
// storage allowance (Neon free = 0.5 GB), which is what triggers a paid plan.

const GiB = 1024 ** 3;
const MiB = 1024 ** 2;

// Overridable so the alert threshold tracks whatever plan you're actually on.
//   USAGE_LIMIT_MB  – storage allowance in MB (default 512 = Neon free 0.5 GB)
//   USAGE_WARN_PCT  – percent-of-limit that flips the status to "warn"
function limits() {
  const limitMb = Number(process.env.USAGE_LIMIT_MB) || 512;
  const warnPct = Number(process.env.USAGE_WARN_PCT) || 80;
  return { limitBytes: limitMb * MiB, warnPct };
}

export type UsageLevel = "ok" | "warn" | "critical";

export type Usage = {
  dbBytes: number;
  limitBytes: number;
  usedPct: number; // 0..100+ of the storage allowance
  level: UsageLevel;
  attachments: { kind: string; bytes: number; count: number }[];
  attachmentBytes: number; // total across all kinds
  counts: { projects: number; tasks: number; pcos: number; attachments: number };
  limitLabel: string; // e.g. "0.5 GB (Neon free)"
};

export function formatBytes(n: number): string {
  if (n >= GiB) return `${(n / GiB).toFixed(2)} GB`;
  if (n >= MiB) return `${(n / MiB).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

export async function getUsage(): Promise<Usage> {
  const { limitBytes, warnPct } = limits();

  const [sizeRows, grouped, projects, tasks, pcos, attachments] = await Promise.all([
    prisma.$queryRaw<{ size: bigint }[]>`SELECT pg_database_size(current_database())::bigint AS size`,
    prisma.attachment.groupBy({ by: ["kind"], _sum: { size: true }, _count: { _all: true } }),
    prisma.project.count(),
    prisma.task.count(),
    prisma.pco.count(),
    prisma.attachment.count(),
  ]);

  const dbBytes = Number(sizeRows[0]?.size ?? 0n);
  const attachmentRows = grouped
    .map((g) => ({ kind: g.kind, bytes: Number(g._sum.size ?? 0), count: g._count._all }))
    .sort((a, b) => b.bytes - a.bytes);
  const attachmentBytes = attachmentRows.reduce((s, r) => s + r.bytes, 0);

  const usedPct = limitBytes > 0 ? (dbBytes / limitBytes) * 100 : 0;
  const level: UsageLevel = usedPct >= 100 ? "critical" : usedPct >= warnPct ? "warn" : "ok";

  const limitGb = limitBytes / GiB;
  const limitLabel = `${limitGb % 1 === 0 ? limitGb : limitGb.toFixed(1)} GB`;

  return {
    dbBytes,
    limitBytes,
    usedPct,
    level,
    attachments: attachmentRows,
    attachmentBytes,
    counts: { projects, tasks, pcos, attachments },
    limitLabel,
  };
}

// One-line summary used in the weekly email and anywhere a compact readout helps.
export function usageSummaryLine(u: Usage): string {
  const flag = u.level === "critical" ? "⚠️ OVER LIMIT" : u.level === "warn" ? "⚠️ approaching limit" : "ok";
  return `Database ${formatBytes(u.dbBytes)} of ${u.limitLabel} (${u.usedPct.toFixed(1)}%) — ${flag}`;
}

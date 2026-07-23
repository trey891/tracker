import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPrimaryProject } from "@/lib/data";
import { Topbar } from "@/components/Topbar";
import { NoProject } from "@/components/EmptyState";
import { Donut } from "@/components/Charts";
import { AddAllowanceButton, AllowanceActions } from "@/components/PcoEditors";
import { AttachmentManager, type AttachmentMeta } from "@/components/AttachmentManager";
import { money, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  Approved: "#22c55e",
  Pending: "#f59e0b",
  ROM: "#38bdf8",
  Voided: "#94a3b8",
};

export default async function PcoLogPage() {
  const session = await auth();
  const project = await getPrimaryProject();
  if (!project) {
    return (
      <>
        <Topbar title="PCO Log" subtitle="Potential change orders & allowances" user={session?.user ?? {}} />
        <NoProject />
      </>
    );
  }

  const [summary, buckets, reasons, funding, allowances, pcoDocs] = await Promise.all([
    prisma.pcoSummary.findUnique({ where: { projectId: project.id } }),
    prisma.pcoStatusBucket.findMany({ where: { projectId: project.id } }),
    prisma.pcoReason.findMany({ where: { projectId: project.id }, orderBy: { value: "desc" } }),
    prisma.pcoFundingSource.findMany({ where: { projectId: project.id }, orderBy: { value: "desc" } }),
    prisma.allowance.findMany({
      where: { projectId: project.id },
      orderBy: { amount: "desc" },
      include: { _count: { select: { attachments: true } } },
    }),
    prisma.attachment.findMany({
      where: { projectId: project.id, taskId: null, allowanceId: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, filename: true, size: true, contentType: true, uploadedBy: true, createdAt: true },
    }),
  ]);
  const pcoDocsInitial: AttachmentMeta[] = pcoDocs.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() }));

  const order = ["Approved", "Pending", "ROM", "Voided"];
  const sortedBuckets = [...buckets].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));

  const totalAllow = allowances.reduce((a, x) => a + x.amount, 0);
  const usedAllow = allowances.reduce((a, x) => a + x.used, 0);

  return (
    <>
      <Topbar
        title="PCO Log"
        subtitle={`${summary?.totalPcos ?? 0} PCOs · ${money(summary?.totalValue, { compact: true })} total value`}
        user={session?.user ?? {}}
      />

      {/* Status buckets */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {sortedBuckets.map((b) => (
          <div key={b.status} className="card card-pad">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS[b.status] ?? "#94a3b8" }} />
              <span className="eyebrow">{b.status}</span>
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">{b.count}</div>
            <div className="text-sm text-slate-400">{money(b.value, { compact: true })}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Status mix donut */}
        <section className="card card-pad">
          <span className="eyebrow">Status breakdown</span>
          <h2 className="mb-4 mt-1 text-lg font-semibold text-white">By value</h2>
          <Donut
            size={170}
            centerValue={money(summary?.totalValue, { compact: true })}
            centerLabel="Total"
            segments={sortedBuckets
              .filter((b) => b.value > 0)
              .map((b) => ({ label: b.status, value: Math.round(b.value / 1000), color: STATUS_COLORS[b.status] ?? "#94a3b8" }))}
          />
        </section>

        {/* Reason analysis */}
        <section className="card card-pad">
          <span className="eyebrow">Reason analysis</span>
          <h2 className="mb-4 mt-1 text-lg font-semibold text-white">Approved PCOs</h2>
          <ul className="space-y-3">
            {reasons.map((r) => (
              <li key={r.id}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-slate-300">{r.reason}</span>
                  <span className="font-semibold text-white">{money(r.value, { compact: true })}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-2">
                  <div className="h-full rounded-full bg-brand" style={{ width: pct(r.pctOfApproved) }} />
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  {r.count} PCOs · {pct(r.pctOfApproved)} of approved
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Funding source */}
        <section className="card card-pad">
          <span className="eyebrow">Funding source</span>
          <h2 className="mb-4 mt-1 text-lg font-semibold text-white">Where it's funded</h2>
          <ul className="space-y-3">
            {funding.map((s) => (
              <li key={s.id} className="flex items-center justify-between border-b border-line/60 pb-3 last:border-0 last:pb-0">
                <div>
                  <div className="text-sm text-slate-200">{s.source}</div>
                  <div className="text-[11px] text-slate-500">{s.count} PCOs · {pct(s.pctOfFunded)}</div>
                </div>
                <span className="text-sm font-semibold text-white">{money(s.value, { compact: true })}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-lg border border-line bg-panel-2/40 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Original contract</span>
              <span className="font-semibold text-white">{money(summary?.originalContractSum, { compact: true })}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-slate-400">Current contract</span>
              <span className="font-semibold text-white">{money(summary?.currentContract, { compact: true })}</span>
            </div>
          </div>
        </section>
      </div>

      {/* Allowances (Exhibit F) */}
      <section className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <span className="eyebrow">Exhibit F</span>
            <h2 className="mt-1 text-lg font-semibold text-white">Owner allowance usage</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-sm">
              <div className="text-slate-400">Used {money(usedAllow, { compact: true })} of {money(totalAllow, { compact: true })}</div>
              <div className="text-status-ontrack">{money(totalAllow - usedAllow, { compact: true })} remaining</div>
            </div>
            <AddAllowanceButton />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-y border-line text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-medium">Allowance</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 text-right font-medium">Used</th>
                <th className="px-4 py-3 text-right font-medium">Balance</th>
                <th className="px-4 py-3 font-medium">PC Reference</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {allowances.map((a) => (
                <tr key={a.id} className="border-b border-line/50 hover:bg-panel-2/40">
                  <td className="px-5 py-3 font-medium text-white">
                    {a.name}
                    {a._count.attachments > 0 && (
                      <span title={`${a._count.attachments} document(s)`} className="ml-2 text-[11px] text-slate-500">📎 {a._count.attachments}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-300">{money(a.amount)}</td>
                  <td className="px-4 py-3 text-right text-slate-400">{money(a.used)}</td>
                  <td className={`px-4 py-3 text-right font-medium ${a.balance > 0 ? "text-status-ontrack" : "text-slate-500"}`}>{money(a.balance)}</td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-slate-500" title={a.pcReference ?? ""}>{a.pcReference ?? "—"}</td>
                  <td className="px-3 py-3"><AllowanceActions allowance={a} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Project-level PCO documents */}
      <section className="card card-pad mt-4">
        <span className="eyebrow">Documents</span>
        <h2 className="mb-4 mt-1 text-lg font-semibold text-white">PCO documents</h2>
        <p className="mb-3 text-xs text-slate-500">
          Attach PCO logs, change-order backup, quotes, or approvals here. To attach files to a specific allowance line, use its Edit button above.
        </p>
        <AttachmentManager projectLevel initial={pcoDocsInitial} />
      </section>
    </>
  );
}

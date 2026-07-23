import { getAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getPrimaryProject, getLatestFinancials } from "@/lib/data";
import { Topbar } from "@/components/Topbar";
import { NoProject } from "@/components/EmptyState";
import { AddAllowanceButton, AllowanceActions } from "@/components/PcoEditors";
import { PcoLogTable, type PcoDTO } from "@/components/PcoLogTable";
import { AttachmentManager, type AttachmentMeta } from "@/components/AttachmentManager";
import { ImportButton } from "@/components/ImportDialog";
import { ScrollX } from "@/components/ScrollX";
import { PCO_STATUSES, PCO_STATUS_COLOR, PCO_STATUS_BADGE, REASON_BADGE, FUNDING_BADGE } from "@/lib/constants";
import { money, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

const sumVal = (list: { value: number | null }[]) => list.reduce((a, p) => a + (p.value ?? 0), 0);

export default async function CostTrackingPage() {
  const { session, access } = await getAccess();
  const canEdit = access !== "viewer";
  const project = await getPrimaryProject();
  if (!project) {
    return (
      <>
        <Topbar title="Cost Tracking" subtitle="Potential change orders, contract impact & allowances" user={session?.user ?? {}} />
        <NoProject />
      </>
    );
  }

  const [pcos, summary, allowances, fin, pcoDocs] = await Promise.all([
    prisma.pco.findMany({ where: { projectId: project.id }, orderBy: { orderIndex: "asc" } }),
    prisma.pcoSummary.findUnique({ where: { projectId: project.id } }),
    prisma.allowance.findMany({
      where: { projectId: project.id },
      orderBy: { amount: "desc" },
      include: { _count: { select: { attachments: true } } },
    }),
    getLatestFinancials(project.id),
    prisma.attachment.findMany({
      where: { projectId: project.id, taskId: null, allowanceId: null, kind: "doc" },
      orderBy: { createdAt: "desc" },
      select: { id: true, filename: true, size: true, contentType: true, uploadedBy: true, createdAt: true },
    }),
  ]);

  // ---- derive aggregates from live PCO rows ----
  const byStatus = (s: string) => pcos.filter((p) => p.status === s);
  const active = pcos.filter((p) => p.status !== "Voided");
  const totalValue = sumVal(pcos);
  const activeValue = sumVal(active);

  const statusRows = PCO_STATUSES.map((s) => {
    const list = byStatus(s);
    return { status: s, count: list.length, value: sumVal(list) };
  });
  const activeTotalCount = active.length;

  const approved = byStatus("Approved");
  const approvedValue = sumVal(approved) || 1;
  const reasonMap = new Map<string, { count: number; value: number }>();
  for (const p of approved) {
    const r = reasonMap.get(p.reason) ?? { count: 0, value: 0 };
    r.count++;
    r.value += p.value ?? 0;
    reasonMap.set(p.reason, r);
  }
  const reasonRows = [...reasonMap.entries()].map(([reason, v]) => ({ reason, ...v, pct: v.value / approvedValue })).sort((a, b) => b.value - a.value);

  const fundingMap = new Map<string, { count: number; value: number }>();
  for (const p of active) {
    const f = fundingMap.get(p.creFunding) ?? { count: 0, value: 0 };
    f.count++;
    f.value += p.value ?? 0;
    fundingMap.set(p.creFunding, f);
  }
  const fundingRows = [...fundingMap.entries()].map(([source, v]) => ({ source, ...v, pct: (activeValue ? v.value / activeValue : 0) })).sort((a, b) => b.value - a.value);

  // ---- contract impact ----
  const originalContract = summary?.originalContractSum ?? fin?.originalBudget ?? 0;
  const approvedSum = sumVal(approved);
  const pendingSum = sumVal(byStatus("Pending"));
  const romSum = sumVal(byStatus("ROM"));
  const currentContract = originalContract + approvedSum;
  const potentialContract = currentContract + pendingSum + romSum;
  const allowanceBalance = allowances.reduce((a, x) => a + x.balance, 0);

  // ---- Exhibit F rows (split "09.00 - Jewel Box" into Div / Scope) ----
  const exhibitRows = allowances.map((a) => {
    const m = a.name.match(/^(\S+)\s*[-–]\s*(.+)$/);
    return {
      id: a.id,
      div: m ? m[1] : "",
      scope: m ? m[2] : a.name,
      amount: a.amount,
      used: a.used,
      balance: a.balance,
      pcReference: a.pcReference,
      docs: a._count.attachments,
      dto: { id: a.id, name: a.name, amount: a.amount, used: a.used, balance: a.balance, pcReference: a.pcReference },
    };
  });
  const exTotals = exhibitRows.reduce((t, r) => ({ amount: t.amount + r.amount, used: t.used + r.used, balance: t.balance + r.balance }), { amount: 0, used: 0, balance: 0 });

  const pcoDto: PcoDTO[] = pcos.map((p) => ({
    id: p.id,
    number: p.number,
    scope: p.scope,
    status: p.status,
    value: p.value,
    oco: p.oco,
    gcFunding: p.gcFunding,
    creFunding: p.creFunding,
    contractorAllowance: p.contractorAllowance,
    contractorContingency: p.contractorContingency,
    reason: p.reason,
    notes: p.notes,
  }));
  const pcoDocsInitial: AttachmentMeta[] = pcoDocs.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() }));

  const kpis = [
    { label: "Total PCOs", count: pcos.length, value: totalValue, color: "#7c5cff" },
    ...statusRows.map((s) => ({ label: s.status, count: s.count, value: s.value, color: PCO_STATUS_COLOR[s.status] })),
  ];

  return (
    <>
      <Topbar
        title="Cost Tracking"
        subtitle={`Potential change orders, contract impact & allowances · Active PCO value ${money(activeValue, { compact: true })}`}
        user={session?.user ?? {}}
        action={
          <div className="flex items-center gap-2">
            {canEdit && <ImportButton label="Import" />}
            <a href="/api/export/pcos" className="btn-ghost">
              Export CSV
            </a>
          </div>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="card card-pad">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: k.color }} />
              <span className="eyebrow">{k.label}</span>
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">{k.count}</div>
            <div className="text-sm text-slate-400">{money(k.value, { compact: true })}</div>
          </div>
        ))}
      </div>

      {/* Breakdown tables */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <BreakdownTable
          eyebrow="Status breakdown"
          title="Share of active PCO value"
          head={["Status", "#", "Value", "%"]}
          rows={statusRows.map((s) => ({
            pill: <Pill label={s.status} cls={PCO_STATUS_BADGE[s.status]} />,
            count: s.count,
            value: s.value,
            pct: activeValue && s.status !== "Voided" ? s.value / activeValue : 0,
          }))}
          totalCount={activeTotalCount}
          totalValue={activeValue}
        />
        <BreakdownTable
          eyebrow="Reason analysis"
          title="Approved PCOs by reason"
          head={["Reason", "#", "Value", "%"]}
          rows={reasonRows.map((r) => ({ pill: <Pill label={r.reason} cls={REASON_BADGE[r.reason]} />, count: r.count, value: r.value, pct: r.pct }))}
          totalCount={approved.length}
          totalValue={sumVal(approved)}
        />
        <BreakdownTable
          eyebrow="CRE funding source"
          title="Where each active PCO is funded"
          head={["Source", "#", "Value", "%"]}
          rows={fundingRows.map((r) => ({ pill: <Pill label={r.source} cls={FUNDING_BADGE[r.source] ?? "text-slate-300 bg-slate-500/10 ring-slate-500/30"} />, count: r.count, value: r.value, pct: r.pct }))}
          totalCount={active.length}
          totalValue={activeValue}
        />
      </div>

      {/* Contract impact summary */}
      <section className="card card-pad mt-4">
        <span className="eyebrow">Contract impact summary</span>
        <h2 className="mb-4 mt-1 text-lg font-semibold text-white">From original contract through potential contract</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          <Impact label="Original Contract Sum" value={money(originalContract)} sub="Per GMP" />
          <Impact label="Total Approved PCOs" value={money(approvedSum)} accent="text-status-ontrack" sub={`${approved.length} approved`} />
          <Impact label="Total Pending PCOs" value={money(pendingSum)} accent="text-status-attention" sub={`${byStatus("Pending").length} pending`} />
          <Impact label="Total ROM PCOs" value={money(romSum)} accent="text-status-done" sub={`${byStatus("ROM").length} ROM`} />
          <Impact label="Current Contract" value={money(currentContract)} sub="Original + Approved" />
          <Impact label="Potential Contract" value={money(potentialContract)} sub="Current + Pending + ROM" />
          <Impact label="Contractor Allowance Remaining" value={money(allowanceBalance)} accent="text-status-ontrack" sub="From Exhibit F" />
          <Impact label="Contractor Contingency Remaining" value={money(fin?.contractorContingency)} accent="text-status-ontrack" sub="Held by contractor" />
        </div>
      </section>

      {/* Exhibit F */}
      <section className="card mt-4">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <span className="eyebrow">Use of allowances (Exhibit F)</span>
            <h2 className="mt-1 text-lg font-semibold text-white">Per the GMP — administered by Beck</h2>
          </div>
          {canEdit && <AddAllowanceButton />}
        </div>
        <ScrollX>
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-y border-line text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-medium">Div.</th>
                <th className="px-4 py-3 font-medium">Scope</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 text-right font-medium">Used</th>
                <th className="px-4 py-3 text-right font-medium">Balance</th>
                <th className="px-4 py-3 font-medium">PC Ref.</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {exhibitRows.map((r) => {
                const usedPct = r.amount ? Math.min(100, (r.used / r.amount) * 100) : 0;
                return (
                  <tr key={r.id} className="border-b border-line/50 hover:bg-panel-2/40">
                    <td className="px-5 py-3 font-mono text-xs text-slate-400">{r.div || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">
                        {r.scope}
                        {r.docs > 0 && <span className="ml-2 text-[11px] text-slate-500">📎 {r.docs}</span>}
                      </div>
                      <div className="mt-1 h-1 w-40 overflow-hidden rounded-full bg-panel-2">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${usedPct}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">{money(r.amount)}</td>
                    <td className="px-4 py-3 text-right text-slate-400">{money(-r.used)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${r.balance > 0 ? "text-status-ontrack" : "text-slate-500"}`}>{money(r.balance)}</td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-slate-500" title={r.pcReference ?? ""}>{r.pcReference ?? "—"}</td>
                    <td className="px-3 py-3">{canEdit && <AllowanceActions allowance={r.dto} />}</td>
                  </tr>
                );
              })}
              <tr className="border-t border-line bg-panel-2/30 font-semibold">
                <td className="px-5 py-3 text-white" colSpan={2}>Totals</td>
                <td className="px-4 py-3 text-right text-white">{money(exTotals.amount)}</td>
                <td className="px-4 py-3 text-right text-slate-300">{money(-exTotals.used)}</td>
                <td className="px-4 py-3 text-right text-status-ontrack">{money(exTotals.balance)}</td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </ScrollX>
      </section>

      {/* Editable PCO log */}
      <section className="mt-4">
        <div className="mb-3">
          <span className="eyebrow">Potential change order log</span>
          <h2 className="mt-1 text-lg font-semibold text-white">Every PCO on the project</h2>
        </div>
        <PcoLogTable pcos={pcoDto} readOnly={!canEdit} />
      </section>

      {/* PCO documents */}
      <section className="card card-pad mt-4">
        <span className="eyebrow">Documents</span>
        <h2 className="mb-4 mt-1 text-lg font-semibold text-white">PCO documents</h2>
        <p className="mb-3 text-xs text-slate-500">Attach PCO logs, change-order backup, quotes, or approvals. For a specific allowance line, use its Edit button above.</p>
        <AttachmentManager projectLevel initial={pcoDocsInitial} readOnly={!canEdit} />
      </section>
    </>
  );
}

function Pill({ label, cls }: { label: string; cls?: string }) {
  return <span className={`pill ${cls ?? "text-slate-300 bg-slate-500/10 ring-slate-500/30"}`}>{label}</span>;
}

function BreakdownTable({
  eyebrow,
  title,
  head,
  rows,
  totalCount,
  totalValue,
}: {
  eyebrow: string;
  title: string;
  head: string[];
  rows: { pill: React.ReactNode; count: number; value: number; pct: number }[];
  totalCount: number;
  totalValue: number;
}) {
  return (
    <section className="card card-pad">
      <span className="eyebrow">{eyebrow}</span>
      <h2 className="mb-3 mt-1 text-base font-semibold text-white">{title}</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-slate-500">
            <th className="pb-2 text-left font-medium">{head[0]}</th>
            <th className="pb-2 text-right font-medium">{head[1]}</th>
            <th className="pb-2 text-right font-medium">{head[2]}</th>
            <th className="pb-2 text-right font-medium">{head[3]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line/40">
              <td className="py-2">{r.pill}</td>
              <td className="py-2 text-right text-slate-300">{r.count}</td>
              <td className="py-2 text-right text-slate-200">{money(r.value, { compact: true })}</td>
              <td className="py-2 text-right text-slate-400">{pct(r.pct)}</td>
            </tr>
          ))}
          <tr className="border-t border-line font-semibold">
            <td className="py-2 text-white">Total</td>
            <td className="py-2 text-right text-white">{totalCount}</td>
            <td className="py-2 text-right text-white">{money(totalValue, { compact: true })}</td>
            <td className="py-2 text-right text-slate-400">100%</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function Impact({ label, value, sub, accent = "text-white" }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel-2/40 p-3">
      <div className="eyebrow">{label}</div>
      <div className={`mt-1.5 text-lg font-semibold ${accent}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

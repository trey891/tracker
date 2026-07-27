import { getAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getPrimaryProject, getLatestFinancials } from "@/lib/data";
import { Topbar } from "@/components/Topbar";
import { NoProject } from "@/components/EmptyState";
import { money, shortDate } from "@/lib/format";
import {
  EditFinancialsButton,
  AddCommitmentButton,
  CommitmentActions,
  AddMilestoneButton,
  MilestoneActions,
} from "@/components/HardCostEditors";
import { ImportButton } from "@/components/ImportDialog";
import { FinancialSummary } from "@/components/FinancialSummary";
import { ScrollX } from "@/components/ScrollX";

export const dynamic = "force-dynamic";

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const FIN_KEYS = [
  "originalBudget", "approvedChanges", "reallocationsFromTI", "currentBudget", "commitments",
  "nonContractedInvoiced", "ffeAllowance", "currentCommitments", "uncommittedBudget", "costsToDate",
  "unspentCommitments", "allowances", "pendingCosPcos", "forecasted", "overUnderBeforeContingency",
  "projectedFinalCost", "contingencyNeeded", "contingencyBalance", "trendingContingencyAtCompletion",
  "contractorContingency", "pcosApprovedPendingCo", "pcosApprovedPendingCoQty", "pcosPending",
  "pcosPendingQty", "totalPcos", "totalPcosQty", "cosApproved", "cosApprovedQty", "totalCos",
  "totalCosQty", "softCostBudget", "softCostCommitments", "softCostContingency", "softCostUncommitted",
  "softCostContingencyBalance", "equityBudget", "equityRequested", "loanBudget", "loanRequested",
] as const;

export default async function HardCostPage() {
  const { session, access } = await getAccess();
  const canEdit = access !== "viewer";
  const project = await getPrimaryProject();
  if (!project) {
    return (
      <>
        <Topbar title="Hard Cost" subtitle="Budget, commitments & forecast" user={session?.user ?? {}} />
        <NoProject />
      </>
    );
  }

  const [fin, commitments, milestones, lineItems] = await Promise.all([
    getLatestFinancials(project.id),
    prisma.commitment.findMany({ where: { projectId: project.id }, orderBy: { totalContract: "desc" } }),
    prisma.milestone.findMany({ where: { projectId: project.id }, orderBy: { seq: "asc" } }),
    prisma.financialLineItem.findMany({ where: { projectId: project.id }, orderBy: { order: "asc" } }),
  ]);

  const f = fin;
  const finInitial = Object.fromEntries(FIN_KEYS.map((k) => [k, (f as Record<string, number | null> | null)?.[k] ?? null]));
  const commitmentDtos = commitments.map((c) => ({
    id: c.id, vendor: c.vendor, contract: c.contract, status: c.status,
    startDate: iso(c.startDate), endDate: iso(c.endDate),
    originalContract: c.originalContract, changeOrderAmount: c.changeOrderAmount, totalContract: c.totalContract,
    pendingCos: c.pendingCos, invoiced: c.invoiced, remaining: c.remaining,
  }));
  const milestoneDtos = milestones.map((m) => ({
    id: m.id, seq: m.seq, description: m.description,
    baseDate: iso(m.baseDate), contractDate: iso(m.contractDate), currentDate: iso(m.currentDate), varianceDays: m.varianceDays,
  }));
  const lineItemDtos = lineItems.map((l) => ({
    id: l.id, section: l.section, label: l.label, value: l.value, emphasis: l.emphasis, order: l.order, rollupKey: l.rollupKey,
  }));

  return (
    <>
      <Topbar
        title="Construction Overview"
        subtitle={`${project.name} · #${project.code} · as of ${f?.asOfDate ? shortDate(f.asOfDate) : "—"}`}
        user={session?.user ?? {}}
        action={
          canEdit ? (
            <div className="flex items-center gap-2">
              <ImportButton hint="drawbudget" label="Import" />
              <EditFinancialsButton initial={finInitial} asOfDate={iso(f?.asOfDate ?? null)} />
            </div>
          ) : undefined
        }
      />

      {/* Budget waterfall */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <FinancialSummary items={lineItemDtos} canEditValues={canEdit} isAdmin={access === "admin"} />

        <div className="space-y-4">
          <section className="card card-pad">
            <span className="eyebrow">Change orders & PCOs</span>
            <div className="mt-3 space-y-3">
              <KV label="PCOs approved (pending CO)" value={money(f?.pcosApprovedPendingCo)} qty={f?.pcosApprovedPendingCoQty} />
              <KV label="PCOs pending" value={money(f?.pcosPending)} qty={f?.pcosPendingQty} tone="attention" />
              <KV label="Total PCOs" value={money(f?.totalPcos)} qty={f?.totalPcosQty} />
              <KV label="COs approved" value={money(f?.cosApproved)} qty={f?.cosApprovedQty} />
            </div>
          </section>

          <section className="card card-pad">
            <span className="eyebrow">Soft costs</span>
            <div className="mt-3 space-y-3">
              <KV label="SC Current Budget" value={money(f?.softCostBudget)} />
              <KV label="Commitments & Invoiced" value={money(f?.softCostCommitments)} />
              <KV label="Uncommitted" value={money(f?.softCostUncommitted)} />
              <KV label="SC Contingency Balance" value={money(f?.softCostContingencyBalance)} tone="good" />
            </div>
          </section>

          <section className="card card-pad">
            <span className="eyebrow">Funding sources</span>
            <div className="mt-3 space-y-3">
              <KV label="Equity — requested / budget" value={`${money(f?.equityRequested, { compact: true })} / ${money(f?.equityBudget, { compact: true })}`} />
              <KV label="Loan — requested / budget" value={`${money(f?.loanRequested, { compact: true })} / ${money(f?.loanBudget, { compact: true })}`} />
            </div>
          </section>
        </div>
      </div>

      {/* Commitments */}
      <section className="card mt-4">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <span className="eyebrow">Commitments register</span>
            <h2 className="mt-1 text-lg font-semibold text-white">Vendor contracts</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">{commitments.length} vendors</span>
            {canEdit && <AddCommitmentButton />}
          </div>
        </div>
        <ScrollX>
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-y border-line text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium">Contract</th>
                <th className="px-4 py-3 text-right font-medium">Original</th>
                <th className="px-4 py-3 text-right font-medium">Change Orders</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-right font-medium">Invoiced</th>
                <th className="px-4 py-3 text-right font-medium">Remaining</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {commitmentDtos.map((c) => (
                <tr key={c.id} className="border-b border-line/50 hover:bg-panel-2/40">
                  <td className="px-5 py-3 font-medium text-white">{c.vendor}</td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-slate-400" title={c.contract ?? ""}>{c.contract ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{money(c.originalContract, { compact: true })}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{c.changeOrderAmount ? money(c.changeOrderAmount, { compact: true }) : "—"}</td>
                  <td className="px-4 py-3 text-right font-medium text-white">{money(c.totalContract, { compact: true })}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{money(c.invoiced, { compact: true })}</td>
                  <td className="px-4 py-3 text-right text-status-ontrack">{money(c.remaining, { compact: true })}</td>
                  <td className="px-3 py-3">{canEdit && <CommitmentActions commitment={c} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollX>
      </section>

      {/* Milestones */}
      <section className="card mt-4">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <span className="eyebrow">Schedule</span>
            <h2 className="mt-1 text-lg font-semibold text-white">Milestones &amp; major activities</h2>
          </div>
          {canEdit && <AddMilestoneButton />}
        </div>
        <ScrollX>
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-y border-line text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-medium">Milestone</th>
                <th className="px-4 py-3 font-medium">Base</th>
                <th className="px-4 py-3 font-medium">Contract</th>
                <th className="px-4 py-3 font-medium">Current</th>
                <th className="px-4 py-3 text-right font-medium">Variance</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {milestoneDtos.map((m) => (
                <tr key={m.id} className="border-b border-line/50 hover:bg-panel-2/40">
                  <td className="px-5 py-3 font-medium text-white">{m.description}</td>
                  <td className="px-4 py-3 text-slate-400">{shortDate(m.baseDate)}</td>
                  <td className="px-4 py-3 text-slate-400">{shortDate(m.contractDate)}</td>
                  <td className="px-4 py-3 text-slate-300">{shortDate(m.currentDate)}</td>
                  <td className={`px-4 py-3 text-right font-medium ${(m.varianceDays ?? 0) > 0 ? "text-status-blocked" : (m.varianceDays ?? 0) < 0 ? "text-status-ontrack" : "text-slate-400"}`}>
                    {m.varianceDays == null ? "—" : m.varianceDays > 0 ? `+${m.varianceDays}d` : m.varianceDays < 0 ? `${m.varianceDays}d` : "on time"}
                  </td>
                  <td className="px-3 py-3">{canEdit && <MilestoneActions milestone={m} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollX>
      </section>
    </>
  );
}

function KV({ label, value, qty, tone }: { label: string; value: string; qty?: number | null; tone?: "good" | "attention" }) {
  const color = tone === "good" ? "text-status-ontrack" : tone === "attention" ? "text-status-attention" : "text-white";
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`text-sm font-semibold ${color}`}>
        {value} {qty != null && <span className="text-xs font-normal text-slate-500">({qty})</span>}
      </span>
    </div>
  );
}

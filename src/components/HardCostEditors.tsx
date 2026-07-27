"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateFinancials,
  upsertCommitment,
  deleteCommitment,
  upsertMilestone,
  deleteMilestone,
} from "@/app/(app)/hard-cost/actions";

type Num = number | null;

// ---------- Financials ----------
// Note: the 5 roll-up figures (Current Budget, Costs to Date, Projected Final
// Cost, Contingency Balance, Over/(Under)) are edited only via the protected
// roll-up rows in the Financial summary, so they are intentionally omitted here.
const FIN_GROUPS: { title: string; fields: [string, string][] }[] = [
  {
    title: "Budget",
    fields: [
      ["originalBudget", "Original Budget (A)"],
      ["approvedChanges", "Approved Changes (B)"],
      ["reallocationsFromTI", "Reallocations from TI (C)"],
    ],
  },
  {
    title: "Commitments & actuals",
    fields: [
      ["currentCommitments", "Current Commitments (H)"],
      ["uncommittedBudget", "Uncommitted Budget (I)"],
      ["unspentCommitments", "Unspent Commitments (K)"],
      ["ffeAllowance", "FF&E Allowance"],
    ],
  },
  {
    title: "Forecast & contingency",
    fields: [
      ["pendingCosPcos", "Pending COs & PCOs (M)"],
      ["trendingContingencyAtCompletion", "Trending Contingency @ Completion (S)"],
      ["contractorContingency", "Contractor Contingency (T)"],
      ["allowances", "Allowances (L)"],
    ],
  },
  {
    title: "Change orders / PCOs",
    fields: [
      ["pcosApprovedPendingCo", "PCOs approved (pending CO) $"],
      ["pcosApprovedPendingCoQty", "PCOs approved qty"],
      ["pcosPending", "PCOs pending $"],
      ["pcosPendingQty", "PCOs pending qty"],
      ["cosApproved", "COs approved $"],
      ["cosApprovedQty", "COs approved qty"],
    ],
  },
  {
    title: "Soft costs",
    fields: [
      ["softCostBudget", "SC Current Budget"],
      ["softCostCommitments", "Commitments & Invoiced"],
      ["softCostUncommitted", "Uncommitted"],
      ["softCostContingencyBalance", "SC Contingency Balance"],
    ],
  },
  {
    title: "Funding",
    fields: [
      ["equityBudget", "Equity budget"],
      ["equityRequested", "Equity requested"],
      ["loanBudget", "Loan budget"],
      ["loanRequested", "Loan requested"],
    ],
  },
];

export function EditFinancialsButton({ initial, asOfDate }: { initial: Record<string, Num>; asOfDate: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  return (
    <>
      <button className="btn-ghost" onClick={() => setOpen(true)}>
        Edit financials
      </button>
      {open && (
        <Modal title="Edit financial summary" onClose={() => setOpen(false)} wide>
          <form
            action={async (fd) => {
              setSaving(true);
              try {
                await updateFinancials(fd);
                setOpen(false);
                router.refresh();
              } finally {
                setSaving(false);
              }
            }}
            className="space-y-5"
          >
            <div>
              <label className="label">As of date</label>
              <input type="date" name="asOfDate" defaultValue={asOfDate ?? ""} className="input max-w-xs" />
            </div>
            {FIN_GROUPS.map((g) => (
              <fieldset key={g.title}>
                <legend className="eyebrow mb-2">{g.title}</legend>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {g.fields.map(([key, label]) => (
                    <div key={key}>
                      <label className="label">{label}</label>
                      <input name={key} defaultValue={initial[key] ?? ""} inputMode="decimal" className="input" placeholder="0" />
                    </div>
                  ))}
                </div>
              </fieldset>
            ))}
            <SaveBar saving={saving} onCancel={() => setOpen(false)} />
          </form>
        </Modal>
      )}
    </>
  );
}

// ---------- Commitments ----------
export type CommitmentDTO = {
  id: string;
  vendor: string;
  contract: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  originalContract: Num;
  changeOrderAmount: Num;
  totalContract: Num;
  pendingCos: Num;
  invoiced: Num;
  remaining: Num;
};

export function AddCommitmentButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-ghost" onClick={() => setOpen(true)}>
        + Add vendor
      </button>
      {open && <CommitmentModal onClose={() => setOpen(false)} />}
    </>
  );
}

export function CommitmentActions({ commitment }: { commitment: CommitmentDTO }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex justify-end gap-1">
      <button onClick={() => setOpen(true)} className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-panel-2 hover:text-white">
        Edit
      </button>
      <button
        onClick={async () => {
          if (!confirm(`Delete commitment for ${commitment.vendor}?`)) return;
          await deleteCommitment(commitment.id);
          router.refresh();
        }}
        className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-status-blocked/10 hover:text-status-blocked"
      >
        Delete
      </button>
      {open && <CommitmentModal commitment={commitment} onClose={() => setOpen(false)} />}
    </div>
  );
}

function CommitmentModal({ commitment, onClose }: { commitment?: CommitmentDTO; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const c = commitment;
  return (
    <Modal title={c ? "Edit commitment" : "Add commitment"} onClose={onClose}>
      <form
        action={async (fd) => {
          setSaving(true);
          try {
            await upsertCommitment(fd);
            onClose();
            router.refresh();
          } finally {
            setSaving(false);
          }
        }}
        className="space-y-4"
      >
        {c && <input type="hidden" name="id" defaultValue={c.id} />}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vendor" name="vendor" defaultValue={c?.vendor} required />
          <Field label="Contract" name="contract" defaultValue={c?.contract ?? ""} />
          <Field label="Original Contract" name="originalContract" defaultValue={c?.originalContract} num />
          <Field label="Change Orders" name="changeOrderAmount" defaultValue={c?.changeOrderAmount} num />
          <Field label="Total Contract" name="totalContract" defaultValue={c?.totalContract} num />
          <Field label="Invoiced" name="invoiced" defaultValue={c?.invoiced} num />
          <Field label="Remaining" name="remaining" defaultValue={c?.remaining} num />
          <Field label="Status" name="status" defaultValue={c?.status ?? "Approved"} />
          <Field label="Start date" name="startDate" defaultValue={c?.startDate ?? ""} type="date" />
          <Field label="End date" name="endDate" defaultValue={c?.endDate ?? ""} type="date" />
        </div>
        <SaveBar saving={saving} onCancel={onClose} />
      </form>
    </Modal>
  );
}

// ---------- Milestones ----------
export type MilestoneDTO = {
  id: string;
  seq: Num;
  description: string;
  baseDate: string | null;
  contractDate: string | null;
  currentDate: string | null;
  varianceDays: Num;
};

export function AddMilestoneButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-ghost" onClick={() => setOpen(true)}>
        + Add milestone
      </button>
      {open && <MilestoneModal onClose={() => setOpen(false)} />}
    </>
  );
}

export function MilestoneActions({ milestone }: { milestone: MilestoneDTO }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex justify-end gap-1">
      <button onClick={() => setOpen(true)} className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-panel-2 hover:text-white">
        Edit
      </button>
      <button
        onClick={async () => {
          if (!confirm(`Delete milestone "${milestone.description}"?`)) return;
          await deleteMilestone(milestone.id);
          router.refresh();
        }}
        className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-status-blocked/10 hover:text-status-blocked"
      >
        Delete
      </button>
      {open && <MilestoneModal milestone={milestone} onClose={() => setOpen(false)} />}
    </div>
  );
}

function MilestoneModal({ milestone, onClose }: { milestone?: MilestoneDTO; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const m = milestone;
  return (
    <Modal title={m ? "Edit milestone" : "Add milestone"} onClose={onClose}>
      <form
        action={async (fd) => {
          setSaving(true);
          try {
            await upsertMilestone(fd);
            onClose();
            router.refresh();
          } finally {
            setSaving(false);
          }
        }}
        className="space-y-4"
      >
        {m && <input type="hidden" name="id" defaultValue={m.id} />}
        <Field label="Milestone" name="description" defaultValue={m?.description} required />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Seq" name="seq" defaultValue={m?.seq} num />
          <Field label="Variance (days)" name="varianceDays" defaultValue={m?.varianceDays} num />
          <Field label="Base date" name="baseDate" defaultValue={m?.baseDate ?? ""} type="date" />
          <Field label="Contract date" name="contractDate" defaultValue={m?.contractDate ?? ""} type="date" />
          <Field label="Current date" name="currentDate" defaultValue={m?.currentDate ?? ""} type="date" />
        </div>
        <SaveBar saving={saving} onCancel={onClose} />
      </form>
    </Modal>
  );
}

// ---------- Shared primitives ----------
function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required,
  num,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: string;
  required?: boolean;
  num?: boolean;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        inputMode={num ? "decimal" : undefined}
        defaultValue={defaultValue ?? ""}
        className="input"
      />
    </div>
  );
}

function SaveBar({ saving, onCancel }: { saving: boolean; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button type="button" onClick={onCancel} className="btn-ghost">
        Cancel
      </button>
      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className={`card w-full ${wide ? "max-w-3xl" : "max-w-lg"}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

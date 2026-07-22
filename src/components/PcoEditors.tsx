"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { upsertAllowance, deleteAllowance } from "@/app/(app)/pco-log/actions";

export type AllowanceDTO = {
  id: string;
  name: string;
  amount: number;
  used: number;
  balance: number;
  pcReference: string | null;
};

export function AddAllowanceButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-ghost" onClick={() => setOpen(true)}>
        + Add allowance
      </button>
      {open && <AllowanceModal onClose={() => setOpen(false)} />}
    </>
  );
}

export function AllowanceActions({ allowance }: { allowance: AllowanceDTO }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex justify-end gap-1">
      <button onClick={() => setOpen(true)} className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-panel-2 hover:text-white">
        Edit
      </button>
      <button
        onClick={async () => {
          if (!confirm(`Delete allowance "${allowance.name}"?`)) return;
          await deleteAllowance(allowance.id);
          router.refresh();
        }}
        className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-status-blocked/10 hover:text-status-blocked"
      >
        Delete
      </button>
      {open && <AllowanceModal allowance={allowance} onClose={() => setOpen(false)} />}
    </div>
  );
}

function AllowanceModal({ allowance, onClose }: { allowance?: AllowanceDTO; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const a = allowance;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-base font-semibold text-white">{a ? "Edit allowance" : "Add allowance"}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        <form
          action={async (fd) => {
            setSaving(true);
            try {
              await upsertAllowance(fd);
              onClose();
              router.refresh();
            } finally {
              setSaving(false);
            }
          }}
          className="space-y-4 p-5"
        >
          {a && <input type="hidden" name="id" defaultValue={a.id} />}
          <div>
            <label className="label">Allowance name</label>
            <input name="name" defaultValue={a?.name ?? ""} required className="input" placeholder="e.g. 09.00 - Jewel Box" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Amount</label>
              <input name="amount" defaultValue={a?.amount ?? ""} inputMode="decimal" className="input" placeholder="0" />
            </div>
            <div>
              <label className="label">Used</label>
              <input name="used" defaultValue={a?.used ?? ""} inputMode="decimal" className="input" placeholder="0" />
            </div>
            <div>
              <label className="label">Balance (blank = auto)</label>
              <input name="balance" defaultValue={a?.balance ?? ""} inputMode="decimal" className="input" placeholder="auto" />
            </div>
            <div>
              <label className="label">PC Reference</label>
              <input name="pcReference" defaultValue={a?.pcReference ?? ""} className="input" placeholder="PC004" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

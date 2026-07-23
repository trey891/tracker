"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PCO_STATUSES,
  PCO_REASONS,
  CRE_FUNDING,
  GC_FUNDING,
  PCO_STATUS_BADGE,
  REASON_BADGE,
  FUNDING_BADGE,
} from "@/lib/constants";
import { createPco, updatePco, deletePco } from "@/app/(app)/pco-log/actions";
import { MultiSelectFilter } from "./MultiSelectFilter";
import { ScrollX } from "./ScrollX";

export type PcoDTO = {
  id: string;
  number: string | null;
  scope: string;
  status: string;
  value: number | null;
  oco: string | null;
  gcFunding: string | null;
  creFunding: string;
  contractorAllowance: number | null;
  contractorContingency: number | null;
  reason: string;
  notes: string | null;
};

export function PcoLogTable({ pcos }: { pcos: PcoDTO[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<PcoDTO[]>(pcos);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string[]>([...PCO_STATUSES]);
  const [funding, setFunding] = useState<string[]>([...CRE_FUNDING]);
  const [reason, setReason] = useState<string[]>([...PCO_REASONS]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PcoDTO | null>(null);

  // keep local rows in sync if the server sends new props after refresh
  useMemo(() => setRows(pcos), [pcos]);

  const filtered = rows.filter((p) => {
    if (!status.includes(p.status)) return false;
    if (!funding.includes(p.creFunding)) return false;
    if (!reason.includes(p.reason)) return false;
    if (q && !`${p.number ?? ""} ${p.scope} ${p.notes ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  function patchLocal(id: string, patch: Partial<PcoDTO>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function save(id: string, patch: Partial<PcoDTO>) {
    patchLocal(id, patch);
    await updatePco(id, patch as Record<string, unknown>);
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this PCO?")) return;
    setRows((rs) => rs.filter((r) => r.id !== id));
    await deletePco(id);
    router.refresh();
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search PCO #, scope, notes…" className="input max-w-xs" />
        <MultiSelectFilter label="Status" options={PCO_STATUSES} selected={status} onChange={setStatus} />
        <MultiSelectFilter label="Funding" options={CRE_FUNDING} selected={funding} onChange={setFunding} />
        <MultiSelectFilter label="Reason" options={PCO_REASONS} selected={reason} onChange={setReason} />
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-slate-500">
            {filtered.length} of {rows.length} PCOs
          </span>
          <button onClick={() => setCreating(true)} className="btn-primary">
            + Add PCO
          </button>
        </div>
      </div>

      {/* Mobile: card list */}
      <div className="space-y-3 md:hidden">
        {filtered.map((p) => (
          <div key={p.id} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] font-mono text-slate-500">{p.number ?? "—"}</div>
                <div className="font-medium text-white">{p.scope}</div>
              </div>
              <span className={`pill shrink-0 ${PCO_STATUS_BADGE[p.status] ?? ""}`}>{p.status}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold tabular-nums text-slate-200">
                {p.value == null ? "—" : `$${p.value.toLocaleString("en-US")}`}
              </span>
              <span className={`pill ${FUNDING_BADGE[p.creFunding] ?? ""}`}>{p.creFunding}</span>
              <span className={`pill ${REASON_BADGE[p.reason] ?? ""}`}>{p.reason}</span>
            </div>
            {p.notes && <p className="mt-2 line-clamp-2 text-xs text-slate-400">{p.notes}</p>}
            <div className="mt-3 flex gap-1 border-t border-line pt-2">
              <button onClick={() => setEditing(p)} className="rounded-md px-2 py-1 text-xs text-slate-300 hover:bg-panel-2">
                Edit
              </button>
              <button onClick={() => remove(p.id)} className="ml-auto rounded-md px-2 py-1 text-xs text-slate-400 hover:text-status-blocked">
                Delete
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="card p-6 text-center text-sm text-slate-500">No PCOs match your filters.</p>}
      </div>

      {/* Desktop: editable table */}
      <div className="card hidden md:block">
        <ScrollX>
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 font-medium">PCO #</th>
                <th className="px-3 py-2 font-medium">Scope</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Value</th>
                <th className="px-3 py-2 text-right font-medium">OCO</th>
                <th className="px-3 py-2 font-medium">GC Funding</th>
                <th className="px-3 py-2 font-medium">CRE Funding</th>
                <th className="px-3 py-2 text-right font-medium">Allowance</th>
                <th className="px-3 py-2 text-right font-medium">Contingency</th>
                <th className="px-3 py-2 font-medium">Reason</th>
                <th className="px-3 py-2 font-medium">Notes</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-line/50 align-middle hover:bg-panel-2/30">
                  <td className="px-3 py-1.5">
                    <EditText value={p.number ?? ""} onSave={(v) => save(p.id, { number: v || null })} className="w-16" placeholder="#" />
                  </td>
                  <td className="px-3 py-1.5 min-w-[220px]">
                    <EditText value={p.scope} onSave={(v) => save(p.id, { scope: v })} className="w-full" />
                  </td>
                  <td className="px-3 py-1.5">
                    <PillSelect value={p.status} options={PCO_STATUSES} badges={PCO_STATUS_BADGE} onChange={(v) => save(p.id, { status: v })} />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <EditNumber value={p.value} onSave={(v) => save(p.id, { value: v })} />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <EditText value={p.oco ?? ""} onSave={(v) => save(p.id, { oco: v || null })} className="w-12 text-right" placeholder="—" />
                  </td>
                  <td className="px-3 py-1.5">
                    <PlainSelect value={p.gcFunding ?? ""} options={["", ...GC_FUNDING]} onChange={(v) => save(p.id, { gcFunding: v || null })} />
                  </td>
                  <td className="px-3 py-1.5">
                    <PillSelect value={p.creFunding} options={CRE_FUNDING} badges={FUNDING_BADGE} onChange={(v) => save(p.id, { creFunding: v })} />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <EditNumber value={p.contractorAllowance} onSave={(v) => save(p.id, { contractorAllowance: v })} />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <EditNumber value={p.contractorContingency} onSave={(v) => save(p.id, { contractorContingency: v })} />
                  </td>
                  <td className="px-3 py-1.5">
                    <PillSelect value={p.reason} options={PCO_REASONS} badges={REASON_BADGE} onChange={(v) => save(p.id, { reason: v })} />
                  </td>
                  <td className="px-3 py-1.5 min-w-[220px]">
                    <EditText value={p.notes ?? ""} onSave={(v) => save(p.id, { notes: v || null })} className="w-full" placeholder="Add a note…" />
                  </td>
                  <td className="px-2 py-1.5">
                    <button onClick={() => remove(p.id)} className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-status-blocked/10 hover:text-status-blocked" title="Delete">
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center text-slate-500">
                    No PCOs match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ScrollX>
      </div>
      <p className="mt-2 hidden text-xs text-slate-500 md:block">Click any cell to edit. Changes save automatically.</p>

      {(creating || editing) && (
        <PcoModal
          pco={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ---------- Add / edit modal ----------
function PcoModal({ pco, onClose, onSaved }: { pco: PcoDTO | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!pco;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    number: pco?.number ?? "",
    scope: pco?.scope ?? "",
    status: pco?.status ?? "Pending",
    value: pco?.value?.toString() ?? "",
    oco: pco?.oco ?? "",
    gcFunding: pco?.gcFunding ?? "",
    creFunding: pco?.creFunding ?? "None/Other",
    contractorAllowance: pco?.contractorAllowance?.toString() ?? "",
    contractorContingency: pco?.contractorContingency?.toString() ?? "",
    reason: pco?.reason ?? "Other",
    notes: pco?.notes ?? "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  const num = (s: string) => {
    const t = s.replace(/[$,]/g, "").trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };

  async function submit() {
    if (!f.scope.trim()) {
      setError("Scope is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const patch = {
        number: f.number.trim() || null,
        scope: f.scope.trim(),
        status: f.status,
        value: num(f.value),
        oco: f.oco.trim() || null,
        gcFunding: f.gcFunding || null,
        creFunding: f.creFunding,
        contractorAllowance: num(f.contractorAllowance),
        contractorContingency: num(f.contractorContingency),
        reason: f.reason,
        notes: f.notes.trim() || null,
      };
      if (isEdit) await updatePco(pco!.id, patch);
      else await createPco(patch);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card max-h-[88vh] w-full max-w-lg overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-panel px-5 py-4">
          <h3 className="text-base font-semibold text-white">{isEdit ? "Edit PCO" : "New PCO"}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">PCO #</label>
              <input value={f.number} onChange={set("number")} className="input" placeholder="e.g. 038" />
            </div>
            <div className="col-span-2">
              <label className="label">Status</label>
              <select value={f.status} onChange={set("status")} className="input">
                {PCO_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Scope</label>
            <input value={f.scope} onChange={set("scope")} required className="input" placeholder="What is this change for?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Value ($)</label>
              <input value={f.value} onChange={set("value")} inputMode="decimal" className="input" placeholder="0" />
            </div>
            <div>
              <label className="label">OCO #</label>
              <input value={f.oco} onChange={set("oco")} className="input" placeholder="—" />
            </div>
            <div>
              <label className="label">GC Funding</label>
              <select value={f.gcFunding} onChange={set("gcFunding")} className="input">
                <option value="">—</option>
                {GC_FUNDING.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">CRE Funding</label>
              <select value={f.creFunding} onChange={set("creFunding")} className="input">
                {CRE_FUNDING.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Contractor Allowance ($)</label>
              <input value={f.contractorAllowance} onChange={set("contractorAllowance")} inputMode="decimal" className="input" placeholder="—" />
            </div>
            <div>
              <label className="label">Contractor Contingency ($)</label>
              <input value={f.contractorContingency} onChange={set("contractorContingency")} inputMode="decimal" className="input" placeholder="—" />
            </div>
            <div className="col-span-2">
              <label className="label">Reason</label>
              <select value={f.reason} onChange={set("reason")} className="input">
                {PCO_REASONS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea value={f.notes} onChange={set("notes")} rows={2} className="input" placeholder="Context, references, follow-ups…" />
          </div>
          {error && <p className="rounded-lg bg-status-blocked/10 px-3 py-2 text-sm text-status-blocked ring-1 ring-status-blocked/30">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button type="button" onClick={submit} disabled={saving} className="btn-primary">
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create PCO"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- inline cell editors ----------
function PillSelect({ value, options, badges, onChange }: { value: string; options: readonly string[]; badges: Record<string, string>; onChange: (v: string) => void }) {
  const cls = badges[value] ?? "text-slate-300 bg-slate-500/10 ring-slate-500/30";
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-medium outline-none ring-1 ${cls}`}
      style={{ appearance: "none", backgroundColor: "transparent" }}
    >
      {options.map((o) => (
        <option key={o} value={o} className="bg-panel text-slate-100">
          {o}
        </option>
      ))}
    </select>
  );
}

function PlainSelect({ value, options, onChange }: { value: string; options: readonly string[]; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-md border border-line bg-transparent px-2 py-1 text-xs text-slate-300 outline-none hover:border-slate-500">
      {options.map((o) => (
        <option key={o} value={o} className="bg-panel">
          {o || "—"}
        </option>
      ))}
    </select>
  );
}

function EditText({ value, onSave, className, placeholder }: { value: string; onSave: (v: string) => void; className?: string; placeholder?: string }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  if (editing) {
    return (
      <input
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (v !== value) onSave(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setV(value);
            setEditing(false);
          }
        }}
        className={`rounded border border-brand/50 bg-panel-2 px-1.5 py-0.5 text-sm text-white outline-none ${className ?? ""}`}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        setV(value);
        setEditing(true);
      }}
      className={`truncate rounded px-1.5 py-0.5 text-left text-sm hover:bg-panel-2 ${value ? "text-slate-200" : "text-slate-600"} ${className ?? ""}`}
      title={value || placeholder}
    >
      {value || placeholder || "—"}
    </button>
  );
}

function EditNumber({ value, onSave }: { value: number | null; onSave: (v: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value?.toString() ?? "");
  const display = value == null ? "—" : value.toLocaleString("en-US");
  if (editing) {
    return (
      <input
        autoFocus
        inputMode="decimal"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          setEditing(false);
          const parsed = v.trim() === "" ? null : Number(v.replace(/[$,]/g, ""));
          const normalized = parsed != null && Number.isFinite(parsed) ? parsed : null;
          if (normalized !== value) onSave(normalized);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="w-24 rounded border border-brand/50 bg-panel-2 px-1.5 py-0.5 text-right text-sm text-white outline-none"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        setV(value?.toString() ?? "");
        setEditing(true);
      }}
      className={`rounded px-1.5 py-0.5 text-right text-sm tabular-nums hover:bg-panel-2 ${value == null ? "text-slate-600" : value < 0 ? "text-status-blocked" : "text-slate-200"}`}
    >
      {display}
    </button>
  );
}

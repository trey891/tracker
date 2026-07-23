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
  const [status, setStatus] = useState("All");
  const [funding, setFunding] = useState("All");
  const [reason, setReason] = useState("All");
  const [busy, setBusy] = useState(false);

  // keep local rows in sync if the server sends new props after refresh
  useMemo(() => setRows(pcos), [pcos]);

  const filtered = rows.filter((p) => {
    if (status !== "All" && p.status !== status) return false;
    if (funding !== "All" && p.creFunding !== funding) return false;
    if (reason !== "All" && p.reason !== reason) return false;
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

  async function add() {
    setBusy(true);
    try {
      await createPco();
      router.refresh();
    } finally {
      setBusy(false);
    }
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
        <Filter value={status} onChange={setStatus} options={["All", ...PCO_STATUSES]} label="statuses" />
        <Filter value={funding} onChange={setFunding} options={["All", ...CRE_FUNDING]} label="funding sources" />
        <Filter value={reason} onChange={setReason} options={["All", ...PCO_REASONS]} label="reasons" />
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-slate-500">
            {filtered.length} of {rows.length} PCOs
          </span>
          <button onClick={add} disabled={busy} className="btn-primary">
            + Add PCO
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
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
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">Click any cell to edit. Changes save automatically.</p>
    </div>
  );
}

function Filter({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: readonly string[]; label: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="input max-w-[190px]">
      {options.map((o) => (
        <option key={o} value={o}>
          {o === "All" ? `All ${label}` : o}
        </option>
      ))}
    </select>
  );
}

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

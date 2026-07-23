"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { applyImport, discardImport } from "@/app/(app)/import-actions";

type Change = {
  key: string;
  label: string;
  currentDisplay: string;
  proposedDisplay: string;
  changed: boolean;
  target: string;
  op: string;
};
type Proposal = { summary: string; changes: Change[]; warnings: string[] };

export function ImportButton({ hint, label = "Import" }: { hint?: "payapp" | "pcolog" | "drawbudget"; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-ghost">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21V9m0 0l-4 4m4-4l4 4M4 7V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2" />
        </svg>
        {label}
      </button>
      {open && <ImportModal hint={hint} onClose={() => setOpen(false)} />}
    </>
  );
}

function ImportModal({ hint, onClose }: { hint?: string; onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<number | null>(null);

  async function onFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      if (hint) fd.set("docType", hint);
      const res = await fetch("/api/import/parse", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `Parse failed (${res.status}).`);
        return;
      }
      setBatchId(data.batchId);
      setProposal(data.proposal);
      // pre-check every change that actually differs
      setAccepted(new Set((data.proposal.changes as Change[]).filter((c) => c.changed).map((c) => c.key)));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function toggle(key: string) {
    setAccepted((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }

  async function apply() {
    if (!batchId) return;
    setBusy(true);
    try {
      const r = await applyImport(batchId, [...accepted]);
      setDone(r.applied);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const changed = proposal?.changes.filter((c) => c.changed) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card max-h-[88vh] w-full max-w-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-panel px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-white">Import from document</h3>
            <p className="text-xs text-slate-500">Upload a pay app (PDF), or a PCO log / draw &amp; budget export (CSV or XLSX). You confirm before anything changes.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="p-5">
          {done != null ? (
            <div className="py-8 text-center">
              <div className="mb-2 text-3xl">✓</div>
              <p className="text-white">Applied {done} change{done === 1 ? "" : "s"}.</p>
              <button onClick={onClose} className="btn-primary mt-4">Close</button>
            </div>
          ) : !proposal ? (
            <div>
              <button
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-panel-2/40 py-10 text-slate-400 hover:border-brand/50"
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 16V4m0 0L8 8m4-4l4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                {busy ? "Reading…" : "Choose a file (PDF, CSV, or XLSX)"}
              </button>
              <input ref={inputRef} type="file" accept=".pdf,.csv,.xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
              {error && <p className="mt-3 rounded-lg bg-status-blocked/10 px-3 py-2 text-sm text-status-blocked ring-1 ring-status-blocked/30">{error}</p>}
            </div>
          ) : (
            <div>
              <p className="mb-3 text-sm text-slate-300">{proposal.summary}</p>
              {proposal.warnings.map((w, i) => (
                <p key={i} className="mb-2 rounded-lg bg-status-attention/10 px-3 py-2 text-xs text-status-attention ring-1 ring-status-attention/30">⚠ {w}</p>
              ))}

              {changed.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">Nothing to change — the document matches your current data.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-line">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line bg-panel-2/40 text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2 text-left font-medium">Apply</th>
                        <th className="px-3 py-2 text-left font-medium">Field</th>
                        <th className="px-3 py-2 text-left font-medium">Current</th>
                        <th className="px-3 py-2 text-left font-medium">New</th>
                      </tr>
                    </thead>
                    <tbody>
                      {changed.map((c) => (
                        <tr key={c.key} className="border-b border-line/50">
                          <td className="px-3 py-2">
                            <input type="checkbox" checked={accepted.has(c.key)} onChange={() => toggle(c.key)} className="h-4 w-4 rounded border-line bg-panel-2" />
                          </td>
                          <td className="px-3 py-2 text-slate-200">{c.label}</td>
                          <td className="px-3 py-2 text-slate-500">{c.currentDisplay}</td>
                          <td className="px-3 py-2 font-medium text-status-ontrack">{c.proposedDisplay}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {error && <p className="mt-3 rounded-lg bg-status-blocked/10 px-3 py-2 text-sm text-status-blocked ring-1 ring-status-blocked/30">{error}</p>}

              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-slate-500">{accepted.size} selected</span>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      if (batchId) await discardImport(batchId);
                      onClose();
                    }}
                    className="btn-ghost"
                  >
                    Cancel
                  </button>
                  <button onClick={apply} disabled={busy || accepted.size === 0} className="btn-primary">
                    {busy ? "Applying…" : `Apply ${accepted.size}`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

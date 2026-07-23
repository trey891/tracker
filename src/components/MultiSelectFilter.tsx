"use client";

import { useEffect, useRef, useState } from "react";

// Include/exclude filter: `selected` is the set of INCLUDED values (all by
// default). Supports select-all / clear-all so you can, e.g., show everything
// except Approved, or everything except Approved and Voided.
export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const allSelected = selected.length === options.length;
  const noneSelected = selected.length === 0;
  const summary = allSelected ? "All" : noneSelected ? "None" : `${selected.length}/${options.length}`;

  function toggle(opt: string) {
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm ${
          allSelected ? "border-line bg-panel-2 text-slate-300" : "border-brand/50 bg-brand/10 text-white"
        }`}
      >
        <span className="text-slate-400">{label}:</span>
        <span className="font-medium">{summary}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-1 w-56 rounded-lg border border-line bg-panel p-1 shadow-card">
          <div className="flex items-center justify-between border-b border-line px-2 py-1.5 text-xs">
            <button onClick={() => onChange([...options])} className="text-brand-soft hover:underline">
              Select all
            </button>
            <button onClick={() => onChange([])} className="text-slate-400 hover:text-white hover:underline">
              Clear
            </button>
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {options.map((opt) => {
              const on = selected.includes(opt);
              return (
                <li key={opt}>
                  <button
                    type="button"
                    onClick={() => toggle(opt)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-200 hover:bg-panel-2"
                  >
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? "border-brand bg-brand text-white" : "border-line"}`}>
                      {on && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <span className="truncate">{opt}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

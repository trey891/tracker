"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/format";
import {
  setLineItemValue,
  addLineItem,
  updateLineItemMeta,
  deleteLineItem,
  moveLineItem,
} from "@/app/(app)/hard-cost/lineitem-actions";

export type LineItemDTO = {
  id: string;
  section: string;
  label: string;
  value: number | null;
  emphasis: boolean;
  order: number;
  rollupKey: string | null;
};

// Per-project Hard Cost Budget → Forecast summary. Contributors edit values
// inline; admins manage the structure (add / rename / reorder / delete).
export function FinancialSummary({
  items,
  canEditValues,
  isAdmin,
}: {
  items: LineItemDTO[];
  canEditValues: boolean;
  isAdmin: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<LineItemDTO | null>(null);

  // Single interleaved list: group by section (first-seen order), rows sorted by
  // `order`. Roll-up rows sit in their natural position, just locked.
  const sections: { name: string; rows: LineItemDTO[] }[] = [];
  for (const it of [...items].sort((a, b) => a.order - b.order)) {
    let s = sections.find((x) => x.name === it.section);
    if (!s) sections.push((s = { name: it.section, rows: [] }));
    s.rows.push(it);
  }
  const hasRollup = items.some((it) => it.rollupKey);

  return (
    <section className="card card-pad lg:col-span-2">
      <div className="flex items-start justify-between">
        <div>
          <span className="eyebrow">Hard cost budget → forecast</span>
          <h2 className="mb-1 mt-1 text-lg font-semibold text-white">Financial summary</h2>
        </div>
        {isAdmin && (
          <button className="btn-ghost" onClick={() => setAdding(true)}>
            + Add line
          </button>
        )}
      </div>

      {sections.length === 0 ? (
        <p className="py-6 text-sm text-slate-500">
          No line items yet.{isAdmin ? " Add lines to match this project's budget breakdown." : ""}
        </p>
      ) : (
        sections.map((s) => (
          <div key={s.name} className="mt-4 first:mt-2">
            {sections.length > 1 && (
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">{s.name}</div>
            )}
            <dl className="divide-y divide-line/60">
              {s.rows.map((it, i) => (
                <LineRow
                  key={it.id}
                  item={it}
                  canEditValues={canEditValues}
                  isAdmin={isAdmin}
                  isFirst={i === 0}
                  isLast={i === s.rows.length - 1}
                  onEdit={() => setEditing(it)}
                  locked={!!it.rollupKey}
                />
              ))}
            </dl>
          </div>
        ))
      )}

      {hasRollup && (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500">
          <LockIcon /> rows feed the Development Dashboard — locked from delete / rename / reorder.
        </p>
      )}

      {adding && <MetaModal onClose={() => setAdding(false)} />}
      {editing && <MetaModal item={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function LockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-600" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function LineRow({
  item,
  canEditValues,
  isAdmin,
  isFirst,
  isLast,
  onEdit,
  locked,
}: {
  item: LineItemDTO;
  canEditValues: boolean;
  isAdmin: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  onEdit?: () => void;
  locked?: boolean;
}) {
  const router = useRouter();
  return (
    <div className="group flex items-center justify-between py-2.5">
      <dt className={`flex items-center gap-1.5 text-sm ${item.emphasis ? "font-semibold text-white" : "text-slate-400"}`}>
        {item.label}
        {locked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-600" aria-label="Roll-up figure (locked)">
            <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        )}
      </dt>
      <dd className="flex items-center gap-1">
        <ValueCell item={item} editable={canEditValues} />
        {isAdmin && !locked && (
          <span className="ml-1 flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
            <IconBtn title="Move up" disabled={isFirst} onClick={async () => { await moveLineItem(item.id, "up"); router.refresh(); }}>↑</IconBtn>
            <IconBtn title="Move down" disabled={isLast} onClick={async () => { await moveLineItem(item.id, "down"); router.refresh(); }}>↓</IconBtn>
            <IconBtn title="Rename / options" onClick={() => onEdit?.()}>✎</IconBtn>
            <IconBtn
              title="Delete"
              danger
              onClick={async () => {
                if (!confirm(`Delete line "${item.label}"?`)) return;
                await deleteLineItem(item.id);
                router.refresh();
              }}
            >
              ✕
            </IconBtn>
          </span>
        )}
      </dd>
    </div>
  );
}

function ValueCell({ item, editable }: { item: LineItemDTO; editable: boolean }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!editable || !edit) {
    return (
      <button
        type="button"
        disabled={!editable}
        onClick={() => editable && setEdit(true)}
        className={`text-sm font-semibold tabular-nums ${item.emphasis ? "text-white" : "text-slate-200"} ${
          editable ? "rounded px-1 hover:bg-panel-2 hover:ring-1 hover:ring-line" : "cursor-default"
        }`}
        title={editable ? "Click to edit" : undefined}
      >
        {money(item.value)}
      </button>
    );
  }

  const save = async (raw: string) => {
    setSaving(true);
    try {
      await setLineItemValue(item.id, raw);
      setEdit(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <input
      autoFocus
      defaultValue={item.value ?? ""}
      inputMode="decimal"
      disabled={saving}
      onBlur={(e) => save(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setEdit(false);
      }}
      className="input h-8 w-32 py-1 text-right text-sm"
      placeholder="0"
    />
  );
}

function IconBtn({
  children,
  title,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded px-1.5 py-0.5 text-xs ${
        danger ? "text-slate-500 hover:bg-status-blocked/10 hover:text-status-blocked" : "text-slate-500 hover:bg-panel-2 hover:text-white"
      } disabled:opacity-30`}
    >
      {children}
    </button>
  );
}

// Add / rename a line item (admin). Value is optional here; day-to-day value
// edits happen inline on the row.
function MetaModal({ item, onClose }: { item?: LineItemDTO; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-base font-semibold text-white">{item ? "Edit line" : "Add line"}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        <form
          action={async (fd) => {
            setSaving(true);
            try {
              if (item) await updateLineItemMeta(fd);
              else await addLineItem(fd);
              onClose();
              router.refresh();
            } finally {
              setSaving(false);
            }
          }}
          className="space-y-4 p-5"
        >
          {item && <input type="hidden" name="id" defaultValue={item.id} />}
          <div>
            <label className="label">Label</label>
            <input name="label" defaultValue={item?.label ?? ""} required className="input" placeholder="e.g. Current Budget (D = A+B−C)" />
          </div>
          <div>
            <label className="label">Section</label>
            <input name="section" defaultValue={item?.section ?? "Hard Cost Budget → Forecast"} className="input" />
          </div>
          {!item && (
            <div>
              <label className="label">Value (optional)</label>
              <input name="value" inputMode="decimal" className="input" placeholder="0" />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" name="emphasis" defaultChecked={item?.emphasis ?? false} className="h-4 w-4 rounded border-line bg-panel-2" />
            Emphasize (bold subtotal row)
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

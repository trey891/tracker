"use client";

import { useEffect, useRef, useState } from "react";
import { deleteAttachment, listAttachments } from "@/app/(app)/attachment-actions";

export type AttachmentMeta = {
  id: string;
  filename: string;
  size: number;
  contentType: string;
  uploadedBy: string | null;
  createdAt: string | Date;
};

function humanSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function fileIcon(type: string) {
  if (type.includes("pdf")) return "📄";
  if (type.startsWith("image/")) return "🖼️";
  if (type.includes("sheet") || type.includes("excel") || type.includes("csv")) return "📊";
  if (type.includes("word") || type.includes("document")) return "📝";
  return "📎";
}

export function AttachmentManager({
  taskId,
  allowanceId,
  projectLevel,
  initial,
  compact,
}: {
  taskId?: string;
  allowanceId?: string;
  projectLevel?: boolean;
  initial?: AttachmentMeta[];
  compact?: boolean;
}) {
  const [items, setItems] = useState<AttachmentMeta[]>(initial ?? []);
  const [loading, setLoading] = useState(!initial);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const data = await listAttachments({ taskId, allowanceId, projectLevel });
    setItems(data as AttachmentMeta[]);
  }

  useEffect(() => {
    if (initial) return;
    refresh().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.set("file", file);
        if (taskId) fd.set("taskId", taskId);
        if (allowanceId) fd.set("allowanceId", allowanceId);
        const res = await fetch("/api/attachments", { method: "POST", body: fd });
        if (!res.ok) {
          setError(res.status === 413 ? `"${file.name}" is over the 4 MB limit.` : `Upload failed: ${await res.text()}`);
          break;
        }
      }
      await refresh();
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Remove this document?")) return;
    await deleteAttachment(id);
    await refresh();
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className={compact ? "text-xs font-medium text-slate-400" : "label mb-0"}>
          Documents {items.length > 0 && <span className="text-slate-500">({items.length})</span>}
        </span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-md border border-line bg-panel-2 px-2.5 py-1 text-xs text-slate-200 hover:border-slate-500 disabled:opacity-60"
        >
          {uploading ? "Uploading…" : "＋ Attach file"}
        </button>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
      </div>

      {error && <p className="mb-2 rounded-md bg-status-blocked/10 px-2 py-1 text-xs text-status-blocked ring-1 ring-status-blocked/30">{error}</p>}

      {loading ? (
        <p className="text-xs text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-500">No documents yet. Attach PDFs, images, or spreadsheets (max 4 MB each).</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 rounded-md border border-line bg-panel-2/40 px-2.5 py-1.5">
              <a
                href={`/api/attachments/${a.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 items-center gap-2 text-sm text-slate-200 hover:text-white"
                title={a.filename}
              >
                <span aria-hidden>{fileIcon(a.contentType)}</span>
                <span className="truncate">{a.filename}</span>
                <span className="shrink-0 text-[11px] text-slate-500">{humanSize(a.size)}</span>
              </a>
              <div className="flex shrink-0 items-center gap-1">
                <a
                  href={`/api/attachments/${a.id}?download=1`}
                  className="rounded px-1.5 py-0.5 text-[11px] text-slate-400 hover:bg-panel hover:text-white"
                  title="Download"
                >
                  ↓
                </a>
                <button
                  type="button"
                  onClick={() => onDelete(a.id)}
                  className="rounded px-1.5 py-0.5 text-[11px] text-slate-400 hover:bg-status-blocked/10 hover:text-status-blocked"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

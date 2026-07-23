"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteAttachment } from "@/app/(app)/attachment-actions";

export type PhotoMeta = {
  id: string;
  filename: string;
  description: string | null;
  takenDate: string | null; // yyyy-mm-dd
  createdAt: string;
  uploadedBy: string | null;
};

function prettyDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function PhotoGallery({ photos }: { photos: PhotoMeta[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [desc, setDesc] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<PhotoMeta | null>(null);

  async function upload() {
    if (files.length === 0) {
      inputRef.current?.click();
      return;
    }
    setError(null);
    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.set("file", file);
        fd.set("kind", "photo");
        if (date) fd.set("takenDate", date);
        if (desc) fd.set("description", desc);
        const res = await fetch("/api/attachments", { method: "POST", body: fd });
        if (!res.ok) {
          setError(res.status === 413 ? `"${file.name}" is over the 5 MB limit.` : `Upload failed: ${await res.text()}`);
          break;
        }
      }
      setFiles([]);
      setDesc("");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this photo?")) return;
    await deleteAttachment(id);
    setLightbox(null);
    router.refresh();
  }

  return (
    <div>
      {/* Uploader */}
      <div className="card card-pad mb-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto_auto] md:items-end">
          <div>
            <label className="label">Photos</label>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              className="block w-full text-sm text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-panel-2 file:px-3 file:py-1.5 file:text-sm file:text-slate-200 hover:file:bg-panel"
            />
          </div>
          <div>
            <label className="label">Date taken</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Description</label>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Level 3 glazing" className="input md:w-56" />
          </div>
          <button onClick={upload} disabled={uploading} className="btn-primary">
            {uploading ? "Uploading…" : files.length > 0 ? `Upload ${files.length}` : "Choose photos"}
          </button>
        </div>
        {files.length > 0 && <p className="mt-2 text-xs text-slate-500">{files.length} selected — date &amp; description apply to all. Max 5 MB each.</p>}
        {error && <p className="mt-2 rounded-md bg-status-blocked/10 px-3 py-1.5 text-xs text-status-blocked ring-1 ring-status-blocked/30">{error}</p>}
      </div>

      {/* Grid */}
      {photos.length === 0 ? (
        <div className="card card-pad py-16 text-center text-sm text-slate-500">No progress photos yet. Add your first above.</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p) => (
            <figure key={p.id} className="card overflow-hidden">
              <button onClick={() => setLightbox(p)} className="block w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/attachments/${p.id}`} alt={p.description ?? p.filename} className="h-44 w-full cursor-zoom-in object-cover transition hover:opacity-90" loading="lazy" />
              </button>
              <figcaption className="p-3">
                <div className="text-sm font-medium text-white">{prettyDate(p.takenDate) ?? prettyDate(p.createdAt)}</div>
                {p.description && <div className="mt-0.5 line-clamp-2 text-xs text-slate-400">{p.description}</div>}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4" onClick={() => setLightbox(null)}>
          <div className="flex items-center justify-between text-slate-200" onClick={(e) => e.stopPropagation()}>
            <div>
              <div className="font-medium text-white">{prettyDate(lightbox.takenDate) ?? prettyDate(lightbox.createdAt)}</div>
              {lightbox.description && <div className="text-sm text-slate-400">{lightbox.description}</div>}
            </div>
            <div className="flex items-center gap-2">
              <a href={`/api/attachments/${lightbox.id}?download=1`} className="btn-ghost" onClick={(e) => e.stopPropagation()}>
                Download
              </a>
              <button onClick={() => remove(lightbox.id)} className="btn-ghost text-status-blocked" onMouseDown={(e) => e.stopPropagation()}>
                Delete
              </button>
              <button onClick={() => setLightbox(null)} className="btn-ghost">
                Close ✕
              </button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center" onClick={() => setLightbox(null)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/attachments/${lightbox.id}`} alt={lightbox.description ?? lightbox.filename} className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
          </div>
          <div className="text-center text-xs text-slate-500">Uploaded by {lightbox.uploadedBy ?? "—"}</div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteAttachment, updatePhoto } from "@/app/(app)/attachment-actions";

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
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
const dayKey = (p: PhotoMeta) => p.takenDate ?? p.createdAt.slice(0, 10);

export function PhotoGallery({ photos, readOnly }: { photos: PhotoMeta[]; readOnly?: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [descs, setDescs] = useState<string[]>([]);
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<PhotoMeta | null>(null);
  const [editing, setEditing] = useState<PhotoMeta | null>(null);
  const [view, setView] = useState<"dates" | "all">("dates");
  const [openDay, setOpenDay] = useState<string | null>(null);

  // Group photos into days, newest day first (photos prop is already sorted).
  const days = useMemo(() => {
    const map = new Map<string, PhotoMeta[]>();
    for (const p of photos) {
      const k = dayKey(p);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    return [...map.entries()].map(([key, items]) => ({ key, items }));
  }, [photos]);

  const openDayPhotos = openDay ? days.find((d) => d.key === openDay)?.items ?? [] : [];

  function pickFiles(list: FileList | null) {
    const arr = Array.from(list ?? []);
    setFiles(arr);
    setDescs(arr.map(() => ""));
  }

  async function upload() {
    if (files.length === 0) {
      inputRef.current?.click();
      return;
    }
    setError(null);
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const fd = new FormData();
        fd.set("file", files[i]);
        fd.set("kind", "photo");
        if (date) fd.set("takenDate", date);
        if (descs[i]?.trim()) fd.set("description", descs[i].trim());
        const res = await fetch("/api/attachments", { method: "POST", body: fd });
        if (!res.ok) {
          setError(res.status === 413 ? `"${files[i].name}" is over the 5 MB limit.` : `Upload failed: ${await res.text()}`);
          break;
        }
      }
      setFiles([]);
      setDescs([]);
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
      {!readOnly && (
      <div className="card card-pad mb-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div>
            <label className="label">Photos</label>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => pickFiles(e.target.files)}
              className="block w-full text-sm text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-panel-2 file:px-3 file:py-1.5 file:text-sm file:text-slate-200 hover:file:bg-panel"
            />
          </div>
          <div>
            <label className="label">Date taken</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
          </div>
          <button onClick={upload} disabled={uploading} className="btn-primary">
            {uploading ? "Uploading…" : files.length > 0 ? `Upload ${files.length}` : "Choose photos"}
          </button>
        </div>

        {/* Per-photo descriptions */}
        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="text-xs font-medium text-slate-400">Add a description for each photo</div>
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={URL.createObjectURL(f)} alt="" className="h-10 w-14 shrink-0 rounded object-cover" />
                <input
                  value={descs[i] ?? ""}
                  onChange={(e) => setDescs((d) => d.map((x, j) => (j === i ? e.target.value : x)))}
                  placeholder={f.name}
                  className="input py-1.5 text-sm"
                  maxLength={80}
                />
              </div>
            ))}
            <p className="text-[11px] text-slate-500">The date applies to all selected photos. Max 5 MB each.</p>
          </div>
        )}
        {error && <p className="mt-2 rounded-md bg-status-blocked/10 px-3 py-1.5 text-xs text-status-blocked ring-1 ring-status-blocked/30">{error}</p>}
      </div>
      )}

      {/* View toggle */}
      {photos.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <div className="flex rounded-lg border border-line bg-panel-2 p-0.5">
            <button
              onClick={() => {
                setView("dates");
                setOpenDay(null);
              }}
              className={`rounded-md px-3 py-1.5 text-sm ${view === "dates" ? "bg-brand/20 text-white" : "text-slate-400"}`}
            >
              By date
            </button>
            <button
              onClick={() => {
                setView("all");
                setOpenDay(null);
              }}
              className={`rounded-md px-3 py-1.5 text-sm ${view === "all" ? "bg-brand/20 text-white" : "text-slate-400"}`}
            >
              All photos
            </button>
          </div>
          <span className="text-xs text-slate-500">
            {view === "all" ? `${photos.length} photos, newest to oldest` : `${days.length} day${days.length === 1 ? "" : "s"}`}
          </span>
        </div>
      )}

      {photos.length === 0 ? (
        <div className="card card-pad py-16 text-center text-sm text-slate-500">No progress photos yet. Add your first above.</div>
      ) : view === "all" ? (
        /* Flat view — newest to oldest */
        <PhotoGrid photos={photos} onOpen={setLightbox} />
      ) : openDay ? (
        /* Single day drill-in */
        <div>
          <button onClick={() => setOpenDay(null)} className="mb-3 flex items-center gap-1.5 text-sm text-brand-soft hover:underline">
            ← All dates
          </button>
          <h2 className="mb-3 text-lg font-semibold text-white">
            {prettyDate(openDay)} <span className="text-sm font-normal text-slate-500">· {openDayPhotos.length} photo{openDayPhotos.length === 1 ? "" : "s"}</span>
          </h2>
          <PhotoGrid photos={openDayPhotos} onOpen={setLightbox} />
        </div>
      ) : (
        /* Date albums */
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {days.map((d) => (
            <button key={d.key} onClick={() => setOpenDay(d.key)} className="card group overflow-hidden text-left">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/attachments/${d.items[0].id}`}
                  alt={prettyDate(d.key) ?? ""}
                  className="h-36 w-full object-cover transition group-hover:opacity-90"
                  loading="lazy"
                />
                <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white">
                  {d.items.length}
                </span>
              </div>
              <div className="p-3">
                <div className="text-sm font-medium text-white">{prettyDate(d.key)}</div>
                <div className="mt-0.5 truncate text-xs text-slate-500">
                  {d.items.find((p) => p.description)?.description ?? `${d.items.length} photo${d.items.length === 1 ? "" : "s"}`}
                </div>
              </div>
            </button>
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
              {!readOnly && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditing(lightbox);
                    setLightbox(null);
                  }}
                  className="btn-ghost"
                >
                  Edit
                </button>
              )}
              <a href={`/api/attachments/${lightbox.id}?download=1`} className="btn-ghost" onClick={(e) => e.stopPropagation()}>
                Download
              </a>
              {!readOnly && (
                <button onClick={() => remove(lightbox.id)} className="btn-ghost text-status-blocked" onMouseDown={(e) => e.stopPropagation()}>
                  Delete
                </button>
              )}
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

      {editing && (
        <EditPhotoModal
          photo={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function EditPhotoModal({ photo, onClose, onSaved }: { photo: PhotoMeta; onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(photo.takenDate ?? photo.createdAt.slice(0, 10));
  const [desc, setDesc] = useState(photo.description ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await updatePhoto(photo.id, { takenDate: date, description: desc });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-base font-semibold text-white">Edit photo</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        <div className="space-y-4 p-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/attachments/${photo.id}`} alt="" className="h-40 w-full rounded-lg object-cover" />
          <div>
            <label className="label">Date taken</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Description</label>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} className="input" placeholder="e.g. Level 3 glazing" maxLength={120} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button type="button" onClick={save} disabled={saving} className="btn-primary">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhotoGrid({ photos, onOpen }: { photos: PhotoMeta[]; onOpen: (p: PhotoMeta) => void }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {photos.map((p) => (
        <figure key={p.id} className="card overflow-hidden">
          <button onClick={() => onOpen(p)} className="block w-full">
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
  );
}

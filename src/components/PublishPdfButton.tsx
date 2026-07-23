"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { listPhotos } from "@/app/(app)/attachment-actions";

type Photo = { id: string; filename: string; description: string | null; takenDate: string | null; createdAt: string };

export function PublishPdfButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  async function openPicker() {
    setOpen(true);
    setPhotos(null);
    const p = (await listPhotos()) as Photo[];
    setPhotos(p);
  }

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 3 ? s : [...s, id]));
  }

  function generate() {
    const qs = selected.length ? `?photos=${selected.join(",")}` : "";
    setOpen(false);
    router.push(`/report/print${qs}`);
  }

  return (
    <>
      <button onClick={openPicker} className="btn-ghost" title="Publish a formatted PDF report">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2h9l5 5v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM14 2v6h6M8 15h8M8 18h5" />
        </svg>
        PDF report
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div className="card max-h-[85vh] w-full max-w-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-panel px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-white">PDF report</h3>
                <p className="text-xs text-slate-500">Pick up to 3 progress photos for page 1 ({selected.length}/3)</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-5">
              {photos === null ? (
                <p className="text-sm text-slate-500">Loading photos…</p>
              ) : photos.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No progress photos uploaded yet. You can still generate the report — it just won&rsquo;t include cover photos.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {photos.map((p) => {
                    const idx = selected.indexOf(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => toggle(p.id)}
                        className={`relative overflow-hidden rounded-lg border-2 ${idx >= 0 ? "border-brand" : "border-line"}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/attachments/${p.id}`} alt={p.description ?? p.filename} className="h-24 w-full object-cover" loading="lazy" />
                        {idx >= 0 && (
                          <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-white">
                            {idx + 1}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-line bg-panel px-5 py-4">
              <p className="text-xs text-slate-500">Opens a print view — use your browser&rsquo;s “Save as PDF”.</p>
              <div className="flex gap-2">
                <button onClick={() => setOpen(false)} className="btn-ghost">Cancel</button>
                <button onClick={generate} className="btn-primary">Generate report</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

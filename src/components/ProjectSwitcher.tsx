"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { switchProject, createProject } from "@/app/(app)/project-actions";

type Project = { id: string; name: string; code: string | null };

export function ProjectSwitcher({ projects, currentId }: { projects: Project[]; currentId: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const current = projects.find((p) => p.id === currentId) ?? projects[0];

  async function choose(id: string) {
    setOpen(false);
    if (id === currentId) return;
    await switchProject(id);
    router.refresh();
  }

  return (
    <div className="relative px-3 pb-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-line bg-panel-2 px-3 py-2 text-left text-sm hover:border-slate-500"
      >
        <span className="min-w-0">
          <span className="block truncate font-medium text-white">{current?.name ?? "Select project"}</span>
          {current?.code && <span className="block text-[11px] text-slate-500">#{current.code}</span>}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-slate-400">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-3 right-3 z-30 mt-1 overflow-hidden rounded-lg border border-line bg-panel shadow-card">
          <ul className="max-h-60 overflow-y-auto py-1">
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => choose(p.id)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-panel-2 ${p.id === currentId ? "text-white" : "text-slate-300"}`}
                >
                  <span className="truncate">{p.name}</span>
                  {p.id === currentId && <span className="text-brand-soft">✓</span>}
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={() => {
              setOpen(false);
              setCreating(true);
            }}
            className="w-full border-t border-line px-3 py-2 text-left text-sm text-brand-soft hover:bg-panel-2"
          >
            + New project
          </button>
        </div>
      )}

      {creating && <NewProjectModal onClose={() => setCreating(false)} />}
    </div>
  );
}

function NewProjectModal({ onClose }: { onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-base font-semibold text-white">New project</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        <form
          action={async (fd) => {
            setSaving(true);
            try {
              await createProject(fd);
            } finally {
              setSaving(false);
            }
          }}
          className="space-y-4 p-5"
        >
          <div>
            <label className="label">Project name</label>
            <input name="name" required className="input" placeholder="e.g. Riverside Tower" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Project #</label>
              <input name="code" className="input" placeholder="000000.00" />
            </div>
            <div>
              <label className="label">Client</label>
              <input name="client" className="input" placeholder="Client / fund" />
            </div>
          </div>
          <div>
            <label className="label">Location</label>
            <input name="location" className="input" placeholder="City, ST" />
          </div>
          <p className="text-xs text-slate-500">
            Starts empty — add tasks and edit financials from within the app.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Creating…" : "Create project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

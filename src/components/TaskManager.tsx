"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { STATUSES, PRIORITIES, WORKSTREAMS } from "@/lib/constants";
import { StatusBadge, PriorityBadge } from "./Badges";
import { AttachmentManager } from "./AttachmentManager";
import { MultiSelectFilter } from "./MultiSelectFilter";
import { ScrollX } from "./ScrollX";
import { isPastDue } from "@/lib/format";
import { createTask, updateTask, deleteTask } from "@/app/(app)/tasks/actions";

export type TaskDTO = {
  id: string;
  title: string;
  workstream: string;
  status: string;
  priority: string;
  lead: string | null;
  deadline: string | null; // yyyy-mm-dd
  note: string | null;
  blocker: string | null;
  topIssue: boolean;
  attachmentCount: number;
};

type TeamMember = { initials: string; name: string };

export function TaskManager({
  tasks,
  team,
  initialStatus,
  initialWorkstream,
  initialQuery,
  initialLead,
  openNew,
  readOnly,
}: {
  tasks: TaskDTO[];
  team: TeamMember[];
  initialStatus?: string;
  initialWorkstream?: string;
  initialQuery?: string;
  initialLead?: string;
  openNew?: boolean;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const leadOptions = useMemo(() => [...team.map((m) => m.initials), "Unassigned"], [team]);
  const [q, setQ] = useState(initialQuery ?? "");
  const [lead, setLead] = useState<string[]>(
    initialLead && leadOptions.includes(initialLead) ? [initialLead] : leadOptions,
  );
  // Default view hides Done tasks; a deep link to a specific status overrides.
  const [status, setStatus] = useState<string[]>(
    initialStatus && (STATUSES as readonly string[]).includes(initialStatus)
      ? [initialStatus]
      : STATUSES.filter((s) => s !== "Done"),
  );
  const [workstream, setWorkstream] = useState<string[]>(
    initialWorkstream && (WORKSTREAMS as readonly string[]).includes(initialWorkstream) ? [initialWorkstream] : [...WORKSTREAMS],
  );
  const [priority, setPriority] = useState<string[]>([...PRIORITIES]);
  const [editing, setEditing] = useState<TaskDTO | null>(null);
  const [creating, setCreating] = useState<boolean>(!!openNew && !readOnly);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    return tasks
      .filter((t) => {
        if (!status.includes(t.status)) return false;
        if (!workstream.includes(t.workstream)) return false;
        if (!priority.includes(t.priority)) return false;
        if (!lead.includes(t.lead ?? "Unassigned")) return false;
        if (q && !`${t.title} ${t.note ?? ""} ${t.lead ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      })
      // earliest deadline first; tasks without a deadline sink to the bottom
      .sort((a, b) => {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline.localeCompare(b.deadline);
      });
  }, [tasks, q, status, workstream, priority, lead]);

  async function onDelete(id: string) {
    if (!confirm("Delete this task? This cannot be undone.")) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("id", id);
    await deleteTask(fd);
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tasks…"
          className="input max-w-xs"
        />
        <MultiSelectFilter label="Status" options={STATUSES} selected={status} onChange={setStatus} />
        <MultiSelectFilter label="Workstream" options={WORKSTREAMS} selected={workstream} onChange={setWorkstream} />
        <MultiSelectFilter label="Priority" options={PRIORITIES} selected={priority} onChange={setPriority} />
        <MultiSelectFilter label="Lead" options={leadOptions} selected={lead} onChange={setLead} />
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-slate-500">{filtered.length} of {tasks.length}</span>
          {!readOnly && (
            <button className="btn-primary" onClick={() => setCreating(true)}>
              + New Task
            </button>
          )}
        </div>
      </div>

      {/* Mobile: card list */}
      <div className="space-y-3 md:hidden">
        {filtered.map((t) => (
          <div key={t.id} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-medium text-white">
                  {t.topIssue && <span className="text-brand-soft">★</span>}
                  <span className="truncate">{t.title}</span>
                  {t.attachmentCount > 0 && <span className="text-[11px] text-slate-500">📎{t.attachmentCount}</span>}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {t.workstream} · {t.lead ?? "Unassigned"}
                  {t.deadline ? ` · due ${t.deadline}` : ""}
                </div>
              </div>
              <div className="shrink-0"><StatusBadge status={t.status} /></div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <PriorityBadge priority={t.priority} />
              {isPastDue(t.deadline, t.status) && <span className="pill text-status-blocked bg-status-blocked/10 ring-status-blocked/30">Past due</span>}
              {t.blocker && <span className="truncate text-xs text-status-blocked">⚠ {t.blocker}</span>}
            </div>
            {!readOnly && (
              <div className="mt-3 flex gap-1 border-t border-line pt-2">
                <button onClick={() => setEditing(t)} className="rounded-md px-2 py-1 text-xs text-slate-300 hover:bg-panel-2">
                  Edit
                </button>
                <button onClick={() => onDelete(t.id)} disabled={busy} className="ml-auto rounded-md px-2 py-1 text-xs text-slate-400 hover:text-status-blocked">
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && <p className="card p-6 text-center text-sm text-slate-500">No tasks match your filters.</p>}
      </div>

      {/* Desktop: table */}
      <div className="card hidden md:block">
        <ScrollX>
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-medium">Task</th>
                <th className="px-4 py-3 font-medium">Workstream</th>
                <th className="px-4 py-3 font-medium">Lead</th>
                <th className="px-4 py-3 font-medium">Deadline</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-line/50 hover:bg-panel-2/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {t.topIssue && <span title="Top issue" className="text-brand-soft">★</span>}
                      <span className="font-medium text-white">{t.title}</span>
                      {t.attachmentCount > 0 && (
                        <span title={`${t.attachmentCount} document(s)`} className="inline-flex items-center gap-0.5 text-[11px] text-slate-500">
                          📎 {t.attachmentCount}
                        </span>
                      )}
                    </div>
                    {t.blocker && <div className="mt-0.5 text-xs text-status-blocked">⚠ {t.blocker}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{t.workstream}</td>
                  <td className="px-4 py-3 text-slate-300">{t.lead ?? "—"}</td>
                  <td className="px-4 py-3">
                    {isPastDue(t.deadline, t.status) ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-status-blocked">{t.deadline}</span>
                        <span className="pill text-status-blocked bg-status-blocked/10 ring-status-blocked/30">Past due</span>
                      </span>
                    ) : (
                      <span className="text-slate-400">{t.deadline ?? "—"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3 text-right">
                    {!readOnly && (
                      <>
                        <button onClick={() => setEditing(t)} className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-panel-2 hover:text-white">
                          Edit
                        </button>
                        <button onClick={() => onDelete(t.id)} disabled={busy} className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-status-blocked/10 hover:text-status-blocked">
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    No tasks match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ScrollX>
      </div>

      {(creating || editing) && (
        <TaskModal
          team={team}
          task={editing}
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

function TaskModal({
  team,
  task,
  onClose,
  onSaved,
}: {
  team: TeamMember[];
  task: TaskDTO | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const isEdit = !!task;

  async function handle(formData: FormData) {
    setSaving(true);
    try {
      if (isEdit) await updateTask(formData);
      else await createTask(formData);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card max-h-[85vh] w-full max-w-lg overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-panel px-5 py-4">
          <h3 className="text-base font-semibold text-white">{isEdit ? "Edit task" : "New task"}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        <form action={handle} className="space-y-4 p-5">
          {isEdit && <input type="hidden" name="id" defaultValue={task!.id} />}
          <div>
            <label className="label">Title</label>
            <input name="title" defaultValue={task?.title ?? ""} required className="input" placeholder="Task title" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Workstream</label>
              <select name="workstream" defaultValue={task?.workstream ?? "Construction"} className="input">
                {WORKSTREAMS.map((w) => (
                  <option key={w}>{w}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Lead</label>
              <select name="lead" defaultValue={task?.lead ?? ""} className="input">
                <option value="">Unassigned</option>
                {team.map((m) => (
                  <option key={m.initials} value={m.initials}>
                    {m.initials} — {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select name="status" defaultValue={task?.status ?? "On Track"} className="input">
                {STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select name="priority" defaultValue={task?.priority ?? "Medium"} className="input">
                {PRIORITIES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Deadline</label>
              <input type="date" name="deadline" defaultValue={task?.deadline ?? ""} className="input" />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" name="topIssue" defaultChecked={task?.topIssue ?? false} className="h-4 w-4 rounded border-line bg-panel-2" />
                Flag as top issue
              </label>
            </div>
          </div>
          <div>
            <label className="label">Status note</label>
            <textarea name="note" defaultValue={task?.note ?? ""} rows={2} className="input" placeholder="Latest update…" />
          </div>
          <div>
            <label className="label">Blocker (if blocked)</label>
            <input name="blocker" defaultValue={task?.blocker ?? ""} className="input" placeholder="What's blocking this?" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create task"}
            </button>
          </div>
        </form>

        {isEdit ? (
          <div className="border-t border-line p-5 pt-4">
            <AttachmentManager taskId={task!.id} />
          </div>
        ) : (
          <p className="border-t border-line px-5 py-3 text-xs text-slate-500">
            Save the task first, then reopen it to attach documents.
          </p>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTeamMember, updateTeamMember, setMemberPassword, deleteTeamMember } from "@/app/(app)/team/actions";

export type Member = { id: string; name: string; email: string; initials: string; role: string; access: string };

// What the signed-in user may do to a given member card.
export type MemberMode = "admin" | "self" | "none";

export function AddMemberButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        + Add member
      </button>
      {open && <MemberModal admin onClose={() => setOpen(false)} />}
    </>
  );
}

export function MemberActions({ member, mode }: { member: Member; mode: MemberMode }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [pw, setPw] = useState(false);
  if (mode === "none") return null;

  return (
    <div className="mt-3 flex gap-1 border-t border-line pt-3">
      <button onClick={() => setEdit(true)} className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-panel-2 hover:text-white">
        {mode === "self" ? "Edit my info" : "Edit"}
      </button>
      {mode === "admin" && (
        <>
          <button onClick={() => setPw(true)} className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-panel-2 hover:text-white">
            Set password
          </button>
          {member.access !== "admin" && (
            <button
              onClick={async () => {
                if (!confirm(`Remove ${member.name}?`)) return;
                try {
                  await deleteTeamMember(member.id);
                  router.refresh();
                } catch (e) {
                  alert((e as Error).message);
                }
              }}
              className="ml-auto rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-status-blocked/10 hover:text-status-blocked"
            >
              Remove
            </button>
          )}
        </>
      )}
      {edit && <MemberModal member={member} admin={mode === "admin"} onClose={() => setEdit(false)} />}
      {pw && <PasswordModal member={member} onClose={() => setPw(false)} />}
    </div>
  );
}

function MemberModal({ member, admin, onClose }: { member?: Member; admin: boolean; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!member;
  const lockedAdmin = member?.access === "admin";

  return (
    <Modal title={isEdit ? (admin ? "Edit member" : "Edit my info") : "Add member"} onClose={onClose}>
      <form
        action={async (fd) => {
          setSaving(true);
          setError(null);
          try {
            if (isEdit) await updateTeamMember(fd);
            else await createTeamMember(fd);
            onClose();
            router.refresh();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setSaving(false);
          }
        }}
        className="space-y-4"
      >
        {isEdit && <input type="hidden" name="id" defaultValue={member!.id} />}
        <div>
          <label className="label">Full name</label>
          <input name="name" defaultValue={member?.name ?? ""} required className="input" placeholder="Jane Doe" />
        </div>
        <div>
          <label className="label">Email</label>
          <input name="email" type="email" defaultValue={member?.email ?? ""} required className="input" placeholder="jane@company.com" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Initials</label>
            <input name="initials" defaultValue={member?.initials ?? ""} className="input" placeholder="JD" maxLength={4} />
          </div>
          <div>
            <label className="label">Role / title</label>
            <input name="role" defaultValue={member?.role ?? ""} className="input" placeholder="Project Coordinator" />
          </div>
        </div>

        {admin && (
          <div>
            <label className="label">Access</label>
            {lockedAdmin ? (
              <p className="rounded-lg border border-line bg-panel-2/40 px-3 py-2 text-sm text-slate-300">
                Admin <span className="text-xs text-slate-500">— the designated admin account can't be changed.</span>
              </p>
            ) : (
              <select name="access" defaultValue={member?.access === "viewer" ? "viewer" : "contributor"} className="input">
                <option value="contributor">Contributor — can edit everything except members &amp; passwords</option>
                <option value="viewer">Viewer — can browse everything, change nothing</option>
              </select>
            )}
          </div>
        )}

        {!isEdit && (
          <div>
            <label className="label">Temporary password</label>
            <input name="password" type="text" required className="input" placeholder="At least 4 characters" />
            <p className="mt-1 text-[11px] text-slate-500">They can sign in with this and you can reset it anytime.</p>
          </div>
        )}
        {error && <p className="rounded-lg bg-status-blocked/10 px-3 py-2 text-sm text-status-blocked ring-1 ring-status-blocked/30">{error}</p>}
        <SaveBar saving={saving} onCancel={onClose} label={isEdit ? "Save" : "Add member"} />
      </form>
    </Modal>
  );
}

function PasswordModal({ member, onClose }: { member: Member; onClose: () => void }) {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal title={`Set password — ${member.name}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">New password</label>
          <input value={pw} onChange={(e) => setPw(e.target.value)} type="text" className="input" placeholder="At least 4 characters" autoFocus />
        </div>
        {error && <p className="rounded-lg bg-status-blocked/10 px-3 py-2 text-sm text-status-blocked ring-1 ring-status-blocked/30">{error}</p>}
        <SaveBar
          saving={saving}
          onCancel={onClose}
          label="Set password"
          onSubmit={async () => {
            setSaving(true);
            setError(null);
            try {
              await setMemberPassword(member.id, pw);
              onClose();
              router.refresh();
            } catch (e) {
              setError((e as Error).message);
              setSaving(false);
            }
          }}
        />
      </div>
    </Modal>
  );
}

function SaveBar({ saving, onCancel, label, onSubmit }: { saving: boolean; onCancel: () => void; label: string; onSubmit?: () => void }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button type="button" onClick={onCancel} className="btn-ghost">
        Cancel
      </button>
      {onSubmit ? (
        <button type="button" onClick={onSubmit} disabled={saving} className="btn-primary">
          {saving ? "Saving…" : label}
        </button>
      ) : (
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Saving…" : label}
        </button>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card max-h-[85vh] w-full max-w-md overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

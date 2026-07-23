import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPrimaryProject, getTasks } from "@/lib/data";
import { getAccess } from "@/lib/authz";
import { Topbar } from "@/components/Topbar";
import { NoProject } from "@/components/EmptyState";
import { StatusBadge } from "@/components/Badges";
import { AddMemberButton, MemberActions, type MemberMode } from "@/components/TeamAdmin";

export const dynamic = "force-dynamic";

const ACCESS_BADGE: Record<string, { label: string; cls: string }> = {
  admin: { label: "Admin", cls: "text-brand-soft bg-brand/10 ring-brand/30" },
  contributor: { label: "Contributor", cls: "text-status-ontrack bg-status-ontrack/10 ring-status-ontrack/30" },
  viewer: { label: "Viewer", cls: "text-slate-300 bg-slate-500/10 ring-slate-500/30" },
};

export default async function TeamPage() {
  const { session, access } = await getAccess();
  const project = await getPrimaryProject();
  const users = await prisma.user.findMany({ orderBy: { name: "asc" } });
  const isAdmin = access === "admin";

  if (!project) {
    return (
      <>
        <Topbar title="Team" subtitle="Who's on the project" user={session?.user ?? {}} />
        <NoProject />
      </>
    );
  }

  const tasks = await getTasks(project.id);
  const byLead = (initials: string) => tasks.filter((t) => t.lead === initials);

  return (
    <>
      <Topbar
        title="Team"
        subtitle={`${users.length} members · ${project.name}`}
        user={session?.user ?? {}}
        action={isAdmin ? <AddMemberButton /> : undefined}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {users.map((u) => {
          const mine = byLead(u.initials);
          const open = mine.filter((t) => t.status !== "Done");
          const blocked = mine.filter((t) => t.status === "Blocked");
          const isMe = session?.user?.id === u.id;
          const mode: MemberMode = isAdmin ? "admin" : isMe && access === "contributor" ? "self" : "none";
          const badge = ACCESS_BADGE[u.access] ?? ACCESS_BADGE.viewer;
          const tasksHref = `/tasks?lead=${encodeURIComponent(u.initials)}`;
          return (
            <div key={u.id} className="card card-pad">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-soft text-sm font-semibold text-white">
                  {u.initials}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-white">{u.name}</span>
                    {isMe && <span className="pill text-brand-soft bg-brand/10 ring-brand/30">you</span>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-400">{u.role}</span>
                    <span className={`pill ${badge.cls}`}>{badge.label}</span>
                  </div>
                </div>
              </div>

              {/* Clickable workload → Tasks filtered to this member */}
              <Link href={tasksHref} className="group mt-4 grid grid-cols-3 gap-2 text-center" title={`View ${u.initials}'s tasks`}>
                <Stat n={mine.length} label="Assigned" />
                <Stat n={open.length} label="Open" />
                <Stat n={blocked.length} label="Blocked" tone={blocked.length ? "bad" : undefined} />
              </Link>

              {mine.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {mine.slice(0, 4).map((t) => (
                    <li key={t.id}>
                      <Link href={tasksHref} className="flex items-center justify-between gap-2 rounded-md px-1 py-0.5 text-sm transition hover:bg-panel-2/60">
                        <span className="truncate text-slate-300 hover:text-white">{t.title}</span>
                        <StatusBadge status={t.status} />
                      </Link>
                    </li>
                  ))}
                  {mine.length > 4 && (
                    <li>
                      <Link href={tasksHref} className="text-xs text-brand-soft hover:underline">
                        View all {mine.length} tasks →
                      </Link>
                    </li>
                  )}
                </ul>
              )}
              <div className="mt-4 text-xs text-slate-500">{u.email}</div>
              <MemberActions
                member={{ id: u.id, name: u.name, email: u.email, initials: u.initials, role: u.role, access: u.access }}
                mode={mode}
              />
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-slate-500">
        {isAdmin ? (
          <>
            As admin, you can add members, edit anyone, set passwords, and assign Contributor or Viewer access. Click a member&rsquo;s
            workload to see their tasks.
          </>
        ) : (
          <>Click a member&rsquo;s workload to see their tasks. Contact the admin to add members or reset passwords.</>
        )}
      </p>
    </>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone?: "bad" }) {
  return (
    <div className="rounded-lg border border-line bg-panel-2/40 py-2 transition group-hover:border-brand/40">
      <div className={`text-xl font-semibold ${tone === "bad" ? "text-status-blocked" : "text-white"}`}>{n}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
  );
}

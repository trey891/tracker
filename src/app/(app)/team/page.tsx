import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPrimaryProject, getTasks } from "@/lib/data";
import { Topbar } from "@/components/Topbar";
import { NoProject } from "@/components/EmptyState";
import { StatusBadge } from "@/components/Badges";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await auth();
  const project = await getPrimaryProject();
  const users = await prisma.user.findMany({ orderBy: { name: "asc" } });

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
      <Topbar title="Team" subtitle={`${users.length} members · ${project.name}`} user={session?.user ?? {}} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {users.map((u) => {
          const mine = byLead(u.initials);
          const open = mine.filter((t) => t.status !== "Done");
          const blocked = mine.filter((t) => t.status === "Blocked");
          const isMe = session?.user?.email?.toLowerCase() === u.email.toLowerCase();
          return (
            <div key={u.id} className="card card-pad">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-soft text-sm font-semibold text-white">
                  {u.initials}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{u.name}</span>
                    {isMe && <span className="pill text-brand-soft bg-brand/10 ring-brand/30">you</span>}
                  </div>
                  <div className="text-xs text-slate-400">{u.role}</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Stat n={mine.length} label="Assigned" />
                <Stat n={open.length} label="Open" />
                <Stat n={blocked.length} label="Blocked" tone={blocked.length ? "bad" : undefined} />
              </div>

              {mine.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {mine.slice(0, 4).map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-slate-300">{t.title}</span>
                      <StatusBadge status={t.status} />
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 text-xs text-slate-500">{u.email}</div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-slate-500">
        Team accounts are created by the seed. To add or remove members, update the seed data or manage the{" "}
        <code className="rounded bg-panel-2 px-1 py-0.5">User</code> table directly.
      </p>
    </>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone?: "bad" }) {
  return (
    <div className="rounded-lg border border-line bg-panel-2/40 py-2">
      <div className={`text-xl font-semibold ${tone === "bad" ? "text-status-blocked" : "text-white"}`}>{n}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
  );
}

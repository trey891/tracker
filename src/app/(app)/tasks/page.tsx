import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPrimaryProjectId, getTasks } from "@/lib/data";
import { Topbar } from "@/components/Topbar";
import { TaskManager, type TaskDTO } from "@/components/TaskManager";
import { NoProject } from "@/components/EmptyState";

export const dynamic = "force-dynamic";

function toDateInput(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; status?: string }>;
}) {
  const session = await auth();
  const sp = await searchParams;
  const projectId = await getPrimaryProjectId();

  if (!projectId) {
    return (
      <>
        <Topbar title="Tasks" subtitle="Every workstream, one list" user={session?.user ?? {}} />
        <NoProject />
      </>
    );
  }

  const [tasks, team] = await Promise.all([
    getTasks(projectId),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { initials: true, name: true } }),
  ]);

  const dtos: TaskDTO[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    workstream: t.workstream,
    status: t.status,
    priority: t.priority,
    lead: t.lead,
    deadline: toDateInput(t.deadline),
    note: t.note,
    blocker: t.blocker,
    topIssue: t.topIssue,
  }));

  return (
    <>
      <Topbar title="Tasks" subtitle="Every workstream, one list" user={session?.user ?? {}} />
      <TaskManager tasks={dtos} team={team} initialStatus={sp.status} openNew={sp.new === "1"} />
    </>
  );
}

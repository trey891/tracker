import { Sidebar } from "@/components/Sidebar";
import { getAllProjects, getCurrentProjectId } from "@/lib/project";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [projects, currentProjectId] = await Promise.all([getAllProjects(), getCurrentProjectId()]);

  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar projects={projects} currentProjectId={currentProjectId} />
      <main className="md:pl-56">
        <div className="mx-auto max-w-[1400px] px-5 py-6 md:px-8">{children}</div>
      </main>
    </div>
  );
}

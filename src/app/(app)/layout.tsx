import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { PushRegistrar } from "@/components/PushRegistrar";
import { getAllProjects, getCurrentProjectId } from "@/lib/project";
import { getAccess } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [projects, currentProjectId, { access }] = await Promise.all([
    getAllProjects(),
    getCurrentProjectId(),
    getAccess(),
  ]);
  const isAdmin = access === "admin";

  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar projects={projects} currentProjectId={currentProjectId} isAdmin={isAdmin} />
      <MobileNav projects={projects} currentProjectId={currentProjectId} isAdmin={isAdmin} />
      <main className="md:pl-56">
        <div className="mx-auto max-w-none px-4 pb-6 pt-[4.5rem] md:px-8 md:pt-6">{children}</div>
      </main>
      <PushRegistrar />
    </div>
  );
}

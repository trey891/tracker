"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { ProjectSwitcher } from "./ProjectSwitcher";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "grid" },
  { href: "/tasks", label: "Tasks", icon: "list" },
  { href: "/hard-cost", label: "Hard Cost", icon: "wallet" },
  { href: "/pco-log", label: "PCO Log", icon: "doc" },
  { href: "/team", label: "Team", icon: "users" },
  { href: "/analytics", label: "Analytics", icon: "chart" },
] as const;

function Icon({ name }: { name: string }) {
  const common = { width: 18, height: 18, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "grid":
      return <svg {...common} viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
    case "list":
      return <svg {...common} viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>;
    case "wallet":
      return <svg {...common} viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M16 14h2" /></svg>;
    case "doc":
      return <svg {...common} viewBox="0 0 24 24"><path d="M14 3v5h5M7 3h8l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM9 13h6M9 17h4" /></svg>;
    case "users":
      return <svg {...common} viewBox="0 0 24 24"><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M21 20a5 5 0 0 0-4-5" /></svg>;
    case "chart":
      return <svg {...common} viewBox="0 0 24 24"><path d="M4 19V5M4 19h16M8 15l3-4 3 2 4-6" /></svg>;
    default:
      return null;
  }
}

export function Sidebar({
  projects,
  currentProjectId,
}: {
  projects: { id: string; name: string; code: string | null }[];
  currentProjectId: string | null;
}) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-line bg-panel/60 md:flex">
      <div className="flex items-center gap-3 px-5 py-5">
        <Logo />
        <div>
          <div className="text-[15px] font-semibold leading-tight text-white">Pulse</div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500">Status Hub</div>
        </div>
      </div>

      {projects.length > 0 && <ProjectSwitcher projects={projects} currentId={currentProjectId} />}

      <nav className="mt-1 flex-1 space-y-1 px-3">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-brand/15 text-white ring-1 ring-brand/40"
                  : "text-slate-400 hover:bg-panel-2 hover:text-slate-200"
              }`}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

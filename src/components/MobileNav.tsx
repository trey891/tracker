"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { PORTFOLIO_NAV, PROJECT_NAV, ADMIN_NAV, NavIcon } from "./Sidebar";

// Phone navigation: fixed top bar with a hamburger opening a slide-over menu
// (nav + project switcher). Hidden on md+ where the sidebar takes over.
export function MobileNav({
  projects,
  currentProjectId,
  isAdmin,
}: {
  projects: { id: string; name: string; code: string | null }[];
  currentProjectId: string | null;
  isAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the menu on navigation.
  useEffect(() => setOpen(false), [pathname]);

  const current = projects.find((p) => p.id === currentProjectId) ?? projects[0];
  const active = [...PORTFOLIO_NAV, ...PROJECT_NAV, ...ADMIN_NAV].find(
    (i) => pathname === i.href || pathname.startsWith(i.href + "/"),
  );

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-30 flex items-center gap-3 border-b border-line bg-panel/95 px-4 py-2.5 backdrop-blur md:hidden">
        <Logo size={30} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold leading-tight text-white">{active?.label ?? "Pulse"}</div>
          {current && <div className="truncate text-[11px] leading-tight text-slate-500">{current.name}</div>}
        </div>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="rounded-lg border border-line bg-panel-2 p-2 text-slate-300"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setOpen(false)}>
          <div
            className="ml-auto flex h-full w-72 max-w-[85vw] flex-col overflow-y-auto border-l border-line bg-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-4">
              <div className="flex items-center gap-2.5">
                <Logo size={30} />
                <div>
                  <div className="text-sm font-semibold text-white">Pulse</div>
                  <div className="text-[10px] uppercase tracking-widest text-slate-500">Status Hub</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-md p-2 text-slate-400">
                ✕
              </button>
            </div>

            <nav className="flex-1 space-y-1 px-3 pb-6">
              {PORTFOLIO_NAV.map((item) => (
                <MobileLink key={item.href} item={item} pathname={pathname} />
              ))}

              {projects.length > 0 && (
                <div className="-mx-3 py-1">
                  <ProjectSwitcher projects={projects} currentId={currentProjectId} />
                </div>
              )}

              <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Project</div>
              {PROJECT_NAV.map((item) => (
                <MobileLink key={item.href} item={item} pathname={pathname} />
              ))}

              {isAdmin && (
                <>
                  <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Admin</div>
                  {ADMIN_NAV.map((item) => (
                    <MobileLink key={item.href} item={item} pathname={pathname} />
                  ))}
                </>
              )}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

function MobileLink({ item, pathname }: { item: { href: string; label: string; icon: string }; pathname: string }) {
  const active = pathname === item.href || pathname.startsWith(item.href + "/");
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
        active ? "bg-brand/15 text-white ring-1 ring-brand/40" : "text-slate-300"
      }`}
    >
      <NavIcon name={item.icon} />
      {item.label}
    </Link>
  );
}

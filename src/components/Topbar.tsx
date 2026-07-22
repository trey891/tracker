import { doSignOut } from "@/app/(app)/actions";

export function Topbar({
  title,
  subtitle,
  user,
  action,
}: {
  title: string;
  subtitle?: string;
  user: { name?: string | null; initials?: string; role?: string };
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {action}
        <div className="flex items-center gap-2 rounded-xl border border-line bg-panel px-3 py-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-soft text-xs font-semibold text-white">
            {user.initials || (user.name ?? "?").slice(0, 2).toUpperCase()}
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-medium leading-tight text-white">{user.name}</div>
            <div className="text-[11px] leading-tight text-slate-400">{user.role}</div>
          </div>
          <form action={doSignOut}>
            <button
              type="submit"
              title="Sign out"
              className="ml-1 rounded-md p-1.5 text-slate-400 transition hover:bg-panel-2 hover:text-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 17l5-5-5-5M21 12H9M12 19H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

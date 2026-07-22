export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card card-pad flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-panel-2 text-slate-500">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 8v4m0 4h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" strokeLinecap="round" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {hint && <p className="mt-2 max-w-md text-sm text-slate-400">{hint}</p>}
    </div>
  );
}

export function NoProject() {
  return (
    <EmptyState
      title="No project data yet"
      hint="The database has no seeded project. Run `npm run db:push` then `npm run db:seed` to load The Crescent Offices on 7th from the workbook."
    />
  );
}

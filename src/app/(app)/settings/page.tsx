import { redirect } from "next/navigation";
import { getAccess } from "@/lib/authz";
import { getUsage, formatBytes } from "@/lib/usage";
import { emailConfigured, DEFAULT_EXPORT_EMAIL } from "@/lib/email";
import { SendExportButton } from "@/components/SendExportButton";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { session, access } = await getAccess();
  if (!session?.user) redirect("/login");
  if (access !== "admin") redirect("/dashboard");

  const usage = await getUsage();
  const configured = emailConfigured();
  const recipient = process.env.EXPORT_EMAIL || DEFAULT_EXPORT_EMAIL;

  const barColor =
    usage.level === "critical" ? "bg-rose-500" : usage.level === "warn" ? "bg-amber-500" : "bg-emerald-500";
  const pctText =
    usage.level === "critical" ? "text-rose-400" : usage.level === "warn" ? "text-amber-400" : "text-emerald-400";

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">Storage usage, cost alerts, and off-platform backups. Admin only.</p>
      </header>

      {/* --- Storage & cost --- */}
      <section className="rounded-xl border border-line bg-panel/60 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Storage &amp; cost</h2>
          <span className={`text-sm font-semibold ${pctText}`}>{usage.usedPct.toFixed(1)}% used</span>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          The whole app lives in one Postgres database — including progress photos and uploaded
          documents. When this bar fills, you&apos;ve outgrown the free tier.
        </p>

        <div className="mt-4">
          <div className="h-3 w-full overflow-hidden rounded-full bg-panel-2">
            <div className={`h-full ${barColor} transition-all`} style={{ width: `${Math.min(100, usage.usedPct)}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-xs text-slate-400">
            <span>{formatBytes(usage.dbBytes)} used</span>
            <span>{usage.limitLabel} limit</span>
          </div>
        </div>

        {usage.level !== "ok" && (
          <div
            className={`mt-4 rounded-lg px-4 py-3 text-sm ${
              usage.level === "critical" ? "bg-rose-500/10 text-rose-300" : "bg-amber-500/10 text-amber-300"
            }`}
          >
            {usage.level === "critical"
              ? "Storage is over the plan limit. Upgrade the database plan (Neon Pro ~$19/mo) to avoid write failures."
              : "Storage is approaching the plan limit. Plan to upgrade the database soon, or trim old progress photos."}
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Projects" value={usage.counts.projects} />
          <Stat label="Tasks" value={usage.counts.tasks} />
          <Stat label="PCOs" value={usage.counts.pcos} />
          <Stat label="Attachments" value={usage.counts.attachments} />
        </div>

        {usage.attachments.length > 0 && (
          <div className="mt-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Attachment storage</div>
            <div className="mt-2 space-y-1 text-sm text-slate-300">
              {usage.attachments.map((a) => (
                <div key={a.kind} className="flex justify-between">
                  <span className="capitalize">
                    {a.kind} <span className="text-slate-500">({a.count})</span>
                  </span>
                  <span>{formatBytes(a.bytes)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-line pt-1 font-semibold text-white">
                <span>Total</span>
                <span>{formatBytes(usage.attachmentBytes)}</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* --- Weekly archive --- */}
      <section className="rounded-xl border border-line bg-panel/60 p-5">
        <h2 className="text-lg font-semibold text-white">Weekly CSV archive</h2>
        <p className="mt-1 text-sm text-slate-400">
          Every Monday morning the tracker emails a full CSV backup of all project data (no images) to{" "}
          <span className="text-slate-200">{recipient}</span>, with the storage summary above included as an early cost warning.
        </p>

        <dl className="mt-4 space-y-2 text-sm">
          <Row label="Schedule">Mondays ~8:00 AM Central (13:00 UTC)</Row>
          <Row label="Recipient">{recipient}</Row>
          <Row label="Contents">Tasks · Cost Tracking (PCOs) · Commitments · Milestones · Allowances · Financials</Row>
          <Row label="Email status">
            {configured ? (
              <span className="text-emerald-400">Configured</span>
            ) : (
              <span className="text-amber-400">Not configured — set RESEND_API_KEY</span>
            )}
          </Row>
        </dl>

        <div className="mt-5">
          <SendExportButton configured={configured} />
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-panel-2 px-3 py-2">
      <div className="text-lg font-semibold text-white">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-3">
      <dt className="w-28 shrink-0 text-slate-500">{label}</dt>
      <dd className="text-slate-200">{children}</dd>
    </div>
  );
}

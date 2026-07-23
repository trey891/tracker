import { buildBackupFiles } from "@/lib/export/backup";
import { sendEmail, emailConfigured, DEFAULT_EXPORT_EMAIL } from "@/lib/email";
import { getUsage, formatBytes, usageSummaryLine, type Usage } from "@/lib/usage";

// The weekly off-platform archive: build a CSV backup of every project and
// email it as attachments, with a storage/cost summary in the body so you get
// an early warning before the database outgrows the free tier. Shared by the
// scheduled cron route and the on-demand "Send now" admin action.

export type WeeklyResult = { ok: boolean; skipped?: boolean; error?: string; fileCount: number; usage: Usage; to: string };

function usageHtml(u: Usage): string {
  const color = u.level === "critical" ? "#dc2626" : u.level === "warn" ? "#d97706" : "#16a34a";
  const rows = u.attachments
    .map((a) => `<tr><td style="padding:2px 12px 2px 0">${a.kind} (${a.count})</td><td>${formatBytes(a.bytes)}</td></tr>`)
    .join("");
  const alert =
    u.level === "ok"
      ? ""
      : `<p style="margin:8px 0;padding:10px 12px;border-radius:8px;background:${color}1a;color:${color};font-weight:600">
           ${u.level === "critical" ? "⚠️ Storage is over the plan limit — upgrade the database plan soon." : "⚠️ Storage is approaching the plan limit — plan to upgrade."}
         </p>`;
  return `
    ${alert}
    <p style="margin:8px 0"><strong>Storage:</strong> ${formatBytes(u.dbBytes)} of ${u.limitLabel}
      (<span style="color:${color};font-weight:600">${u.usedPct.toFixed(1)}%</span>)</p>
    <p style="margin:8px 0"><strong>Attachments (photos + docs):</strong> ${formatBytes(u.attachmentBytes)}</p>
    <table style="border-collapse:collapse;font-size:13px;color:#334155;margin:4px 0 12px">${rows}</table>
    <p style="margin:8px 0;font-size:13px;color:#64748b">
      ${u.counts.projects} projects · ${u.counts.tasks} tasks · ${u.counts.pcos} PCOs · ${u.counts.attachments} attachments
    </p>`;
}

export async function runWeeklyExport(): Promise<WeeklyResult> {
  const [files, usage] = await Promise.all([buildBackupFiles(), getUsage()]);
  const to = process.env.EXPORT_EMAIL || DEFAULT_EXPORT_EMAIL;
  const stamp = new Date().toISOString().slice(0, 10);

  const attachments = files.map((f) => ({
    filename: f.filename,
    content: Buffer.from(f.content, "utf-8").toString("base64"),
  }));

  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;color:#0f172a;max-width:640px">
      <h2 style="margin:0 0 4px">Pulse weekly archive — ${stamp}</h2>
      <p style="margin:0 0 16px;color:#475569">
        Attached are ${files.length} CSV files backing up all project data (tasks, cost tracking,
        commitments, milestones, allowances, and financials). Images are not included.
      </p>
      <h3 style="margin:16px 0 4px">Storage &amp; cost</h3>
      ${usageHtml(usage)}
      <p style="margin:16px 0 0;font-size:12px;color:#94a3b8">Automated backup from your Pulse tracker.</p>
    </div>`;

  if (!emailConfigured()) {
    return { ok: false, skipped: true, fileCount: files.length, usage, to };
  }

  const flag = usage.level === "ok" ? "" : usage.level === "critical" ? " ⚠️ over storage limit" : " ⚠️ storage warning";
  const sent = await sendEmail({
    to,
    subject: `Pulse weekly archive — ${stamp}${flag}`,
    html,
    attachments,
  });
  return { ok: sent.ok, skipped: sent.skipped, error: sent.error, fileCount: files.length, usage, to };
}

export { usageSummaryLine };

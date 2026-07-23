"use server";

import { requireAccess } from "@/lib/authz";
import { runWeeklyExport } from "@/lib/export/weekly";
import { emailConfigured } from "@/lib/email";

export type SendState = { ok: boolean; message: string } | null;

// Admin-only: build and email the CSV archive immediately (same job the weekly
// cron runs), so you can test delivery or grab an on-demand backup.
export async function sendExportNow(_prev: SendState, _formData: FormData): Promise<SendState> {
  await requireAccess("admin");
  if (!emailConfigured()) {
    return { ok: false, message: "Email isn't set up yet — add RESEND_API_KEY (and EXPORT_EMAIL) to the server environment, then redeploy." };
  }
  const r = await runWeeklyExport();
  if (r.ok) return { ok: true, message: `Sent ${r.fileCount} CSV files to ${r.to}.` };
  return { ok: false, message: r.error || "Send failed — check RESEND_API_KEY and the sender/recipient." };
}

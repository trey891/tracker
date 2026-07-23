// Minimal transactional-email sender built on Resend's REST API (no SDK
// dependency — just fetch). Fully no-ops unless RESEND_API_KEY is set, so it
// never breaks a request before email is configured.
//
// Configure in the environment:
//   RESEND_API_KEY  – your Resend API key
//   EXPORT_EMAIL    – recipient for the weekly archive (default below)
//   EXPORT_FROM     – verified sender. Without a verified domain, Resend lets
//                     you send from onboarding@resend.dev to your OWN account
//                     email — which is exactly the weekly-archive-to-self case.

export const DEFAULT_EXPORT_EMAIL = "dewallette@gmail.com";

type Attachment = { filename: string; content: string /* base64 */ };

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendEmail(opts: {
  to?: string;
  subject: string;
  html: string;
  attachments?: Attachment[];
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, skipped: true };

  const to = opts.to || process.env.EXPORT_EMAIL || DEFAULT_EXPORT_EMAIL;
  const from = process.env.EXPORT_FROM || "Pulse <onboarding@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject: opts.subject, html: opts.html, attachments: opts.attachments }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${text.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

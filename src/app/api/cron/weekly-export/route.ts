import { runWeeklyExport } from "@/lib/export/weekly";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Scheduled by Vercel Cron (see vercel.json). Vercel sends the request with
// `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set, which we
// require so the endpoint can't be triggered by anyone else.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  }

  const result = await runWeeklyExport();
  return Response.json({
    ok: result.ok,
    skipped: result.skipped ?? false,
    files: result.fileCount,
    to: result.to,
    storage: { usedPct: Number(result.usage.usedPct.toFixed(1)), level: result.usage.level },
    error: result.error,
  });
}

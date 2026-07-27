import { getAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getCurrentProjectId } from "@/lib/project";
import { extractPdfText } from "@/lib/import/pdf";
import { parseG702, type G702 } from "@/lib/import/payapp";
import { parsePcoCsv, parsePcoWorkbook, type PcoRow } from "@/lib/import/pcolog";
import { parseDrawBudget } from "@/lib/import/drawbudget";
import type { Change, DocType, Proposal } from "@/lib/import/types";

export const dynamic = "force-dynamic";

const MAX = 8 * 1024 * 1024;
const usd = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const near = (a: number | null | undefined, b: number | null | undefined) =>
  Math.abs((a ?? 0) - (b ?? 0)) < 1;

export async function POST(request: Request) {
  const { session, access } = await getAccess();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  if (access === "viewer") return new Response("Your account is view-only.", { status: 403 });
  const projectId = await getCurrentProjectId();
  if (!projectId) return new Response("No project", { status: 404 });

  const form = await request.formData();
  const file = form.get("file");
  const hint = (form.get("docType") as string) || "";
  if (!(file instanceof File) || file.size === 0) return new Response("No file", { status: 400 });
  if (file.size > MAX) return new Response("File too large (max 8 MB)", { status: 413 });

  const name = file.name;
  const ext = name.toLowerCase().split(".").pop() || "";
  const buf = await file.arrayBuffer();

  let docType: DocType | null = null;
  let proposal: Proposal | null = null;

  try {
    // Branch by file type FIRST so a spreadsheet is never handed to the PDF
    // parser. The "payapp" hint only forces the PDF path for an extension-less
    // upload — a real .xlsx/.xls/.csv always routes to its own parser.
    if (ext === "pdf" || (!ext && hint === "payapp")) {
      const text = await extractPdfText(new Uint8Array(buf));
      const g = parseG702(text);
      if (!g) {
        return Response.json({ error: "Couldn't recognize this as a G702 pay application. Check that it's a text-based PDF (not a scan)." }, { status: 422 });
      }
      docType = "payapp";
      proposal = await buildPayApp(projectId, g);
    } else if (ext === "csv") {
      docType = "pcolog";
      proposal = await buildPco(projectId, parsePcoCsv(new TextDecoder().decode(buf)));
    } else if (ext === "xlsx" || ext === "xls") {
      // Excel could be a PCO log or a draw/budget export — detect by content.
      const rows = hint === "drawbudget" ? [] : await parsePcoWorkbook(buf);
      if (hint !== "drawbudget" && rows.length > 0) {
        docType = "pcolog";
        proposal = await buildPco(projectId, rows);
      } else {
        docType = "drawbudget";
        proposal = await buildDrawBudget(projectId, buf);
      }
    } else {
      return Response.json({ error: `Unsupported file type ".${ext}". Upload a PDF (pay app), or CSV/XLSX (PCO log or draw/budget).` }, { status: 415 });
    }
  } catch (e) {
    return Response.json({ error: `Could not parse the file: ${(e as Error).message}` }, { status: 422 });
  }

  const batch = await prisma.importBatch.create({
    data: {
      projectId,
      docType: docType!,
      filename: name,
      status: "pending",
      proposal: proposal as never,
      uploadedBy: session.user.name ?? session.user.email ?? null,
    },
    select: { id: true },
  });

  return Response.json({ batchId: batch.id, docType, filename: name, proposal });
}

// ---------- proposal builders ----------
async function buildPayApp(projectId: string, g: G702): Promise<Proposal> {
  const warnings: string[] = [];
  const changes: Change[] = [];

  const beck = await prisma.commitment.findFirst({
    where: { projectId, vendor: { contains: "BECK", mode: "insensitive" } },
    orderBy: { totalContract: "desc" },
  });
  if (beck) {
    const remaining = +(g.contractSumToDate - g.completed).toFixed(2);
    const c = (field: string, label: string, cur: number | null, val: number) =>
      changes.push({
        key: `commitment.${field}`,
        target: "commitment",
        op: "update",
        entityId: beck.id,
        field,
        value: val,
        label: `Beck — ${label}`,
        currentDisplay: usd(cur),
        proposedDisplay: usd(val),
        changed: !near(cur, val),
      });
    c("originalContract", "Original Contract", beck.originalContract, g.original);
    c("changeOrderAmount", "Change Orders", beck.changeOrderAmount, g.netChange);
    c("totalContract", "Total Contract", beck.totalContract, g.contractSumToDate);
    c("invoiced", "Invoiced (completed)", beck.invoiced, g.completed);
    c("remaining", "Remaining", beck.remaining, remaining);
  } else {
    warnings.push("No 'Beck' commitment found — contract lines will be skipped. Add the GC commitment first to import those.");
  }

  const fin = await prisma.financialSnapshot.findFirst({ where: { projectId }, orderBy: { asOfDate: "desc" } });
  if (fin) {
    const f = (field: string, label: string, cur: number | null, val: number) =>
      changes.push({
        key: `financials.${field}`,
        target: "financials",
        op: "update",
        entityId: fin.id,
        field,
        value: val,
        label,
        currentDisplay: usd(cur),
        proposedDisplay: usd(val),
        changed: !near(cur, val),
      });
    f("cosApproved", "COs Approved", fin.cosApproved, g.netChange);
    f("retainage", "Retainage", fin.retainage, g.retainage);
    f("currentPaymentDue", "Current Payment Due", fin.currentPaymentDue, g.currentPayment);
  } else {
    warnings.push("No financial snapshot found for this project.");
  }

  const app = g.applicationNo ? `Pay App #${g.applicationNo}` : "Pay application";
  const period = g.periodTo ? ` · period to ${g.periodTo}` : "";
  return { summary: `${app}${period}: ${changes.filter((c) => c.changed).length} field(s) will change.`, changes, warnings };
}

async function buildPco(projectId: string, rows: PcoRow[]): Promise<Proposal> {
  const warnings: string[] = [];
  const changes: Change[] = [];
  if (rows.length === 0) warnings.push("No PCO rows found in the file. Check the column headers (PCO #, Scope, Status, Value…).");

  const existing = await prisma.pco.findMany({ where: { projectId } });
  const keyOf = (n: string | null, s: string) => `${(n ?? "").trim().toLowerCase()}|${s.trim().toLowerCase()}`;
  const byKey = new Map(existing.map((p) => [keyOf(p.number, p.scope), p]));

  const fields: (keyof PcoRow)[] = ["status", "value", "oco", "gcFunding", "creFunding", "contractorAllowance", "contractorContingency", "reason", "notes"];

  let updated = 0;
  let created = 0;
  rows.forEach((r, i) => {
    const match = byKey.get(keyOf(r.number, r.scope));
    if (match) {
      const patch: Record<string, unknown> = {};
      const diffs: string[] = [];
      for (const f of fields) {
        const nv = r[f];
        const ov = (match as unknown as Record<string, unknown>)[f];
        if (nv != null && String(nv) !== String(ov ?? "")) {
          patch[f] = nv;
          diffs.push(f);
        }
      }
      if (diffs.length) {
        updated++;
        changes.push({
          key: `pco.update.${match.id}`,
          target: "pco",
          op: "update",
          entityId: match.id,
          record: patch,
          label: `${r.number ?? "—"} · ${r.scope}`,
          currentDisplay: `${diffs.length} field(s)`,
          proposedDisplay: diffs.map((d) => `${d}=${String(r[d as keyof PcoRow])}`).join(", ").slice(0, 80),
          changed: true,
        });
      }
    } else {
      created++;
      changes.push({
        key: `pco.create.${i}`,
        target: "pco",
        op: "create",
        record: r as unknown as Record<string, unknown>,
        label: `${r.number ?? "—"} · ${r.scope}`,
        currentDisplay: "new",
        proposedDisplay: `${r.status} · ${r.value ?? "—"}`,
        changed: true,
      });
    }
  });

  return { summary: `PCO log: ${created} new, ${updated} updated, ${rows.length - created - updated} unchanged.`, changes, warnings };
}

async function buildDrawBudget(projectId: string, buf: ArrayBuffer): Promise<Proposal> {
  const result = await parseDrawBudget(buf);
  const warnings: string[] = [];
  const changes: Change[] = [];

  if (result.format === "unknown") warnings.push("Couldn't recognize this as a draw sheet or job-detail budget export.");

  const fin = await prisma.financialSnapshot.findFirst({ where: { projectId }, orderBy: { asOfDate: "desc" } });
  if (fin) {
    for (const h of result.financials) {
      const cur = (fin as unknown as Record<string, number | null>)[h.field] ?? null;
      changes.push({
        key: `financials.${h.field}`,
        target: "financials",
        op: "update",
        entityId: fin.id,
        field: h.field,
        value: h.value,
        label: h.label,
        currentDisplay: usd(cur),
        proposedDisplay: usd(h.value),
        changed: !near(cur, h.value),
      });
    }
    // GC/Construction retainage → financials, if the draw sheet carried it
    if (result.gc?.retainage != null && !changes.some((c) => c.field === "retainage")) {
      changes.push({
        key: "financials.retainage",
        target: "financials",
        op: "update",
        entityId: fin.id,
        field: "retainage",
        value: result.gc.retainage,
        label: "Retainage",
        currentDisplay: usd(fin.retainage),
        proposedDisplay: usd(result.gc.retainage),
        changed: !near(fin.retainage, result.gc.retainage),
      });
    }
  } else {
    warnings.push("No financial snapshot found for this project.");
  }

  // GC/Construction line → Beck commitment
  if (result.gc) {
    const beck = await prisma.commitment.findFirst({
      where: { projectId, vendor: { contains: "BECK", mode: "insensitive" } },
      orderBy: { totalContract: "desc" },
    });
    if (beck) {
      const g = result.gc;
      const c = (field: string, label: string, cur: number | null, val: number | null) => {
        if (val == null) return;
        changes.push({
          key: `commitment.${field}`,
          target: "commitment",
          op: "update",
          entityId: beck.id,
          field,
          value: val,
          label: `Beck — ${label}`,
          currentDisplay: usd(cur),
          proposedDisplay: usd(val),
          changed: !near(cur, val),
        });
      };
      c("originalContract", "Original Contract", beck.originalContract, g.original);
      c("changeOrderAmount", "Change Orders", beck.changeOrderAmount, g.changeOrder);
      c("totalContract", "Total Contract", beck.totalContract, g.total);
      c("invoiced", "Invoiced", beck.invoiced, g.invoiced);
      c("remaining", "Remaining", beck.remaining, g.remaining);
    } else {
      warnings.push("No 'Beck' commitment found — the GC/Construction line will be skipped.");
    }
  }

  return { summary: `Draw/budget: ${changes.filter((c) => c.changed).length} field(s) will change.`, changes, warnings };
}

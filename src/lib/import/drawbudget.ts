import ExcelJS from "exceljs";

// Parses two real accounting exports:
//  - Draw Sheet (sheet "Current"): columns Original / Revisions / Revised /
//    Prior / This / Total(drawn) / % / Remaining / This Retn / Total Retn.
//    Subtotal rows ("Total Construction Hard Costs", "Total Hard Cost
//    Contingency") map straight to the hard-cost financials; the
//    "GC/Construction" line maps to the Beck commitment.
//  - Job Detail Report (sheet "Jobs"): Budget / Revision / Revbudget /
//    Commitments / Invoiced / Cost to Complete. The "GC/Construction" line
//    maps to the Beck commitment; the 200-series subtotal to current budget.

export type FinHit = { field: string; label: string; value: number };
export type GcLine = {
  original: number | null;
  changeOrder: number | null;
  total: number | null;
  invoiced: number | null;
  remaining: number | null;
  retainage: number | null;
};
export type DrawBudgetResult = { format: "draw" | "jobdetail" | "unknown"; financials: FinHit[]; gc: GcLine | null };

function toNum(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v && typeof v === "object" && "result" in (v as object)) return toNum((v as { result: unknown }).result);
  if (v == null) return null;
  const n = Number(String(v).replace(/[$,()]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}
const labelOf = (ws: ExcelJS.Worksheet, r: number, col: number) => String(ws.getRow(r).getCell(col).value ?? "").trim();

export async function parseDrawBudget(buffer: ArrayBuffer): Promise<DrawBudgetResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return { format: "unknown", financials: [], gc: null };

  const a1 = String(ws.getRow(1).getCell(1).value ?? "");
  // detect header text anywhere in the first ~12 rows
  let allHead = "";
  for (let r = 1; r <= Math.min(ws.rowCount, 12); r++)
    for (let c = 1; c <= Math.min(ws.columnCount, 30); c++) allHead += " " + String(ws.getRow(r).getCell(c).value ?? "");

  if (/Draw Sheet/i.test(a1) || (/Retention/i.test(allHead) && /Request/i.test(allHead))) return parseDraw(ws);
  if (/^Job:/i.test(a1) || /Revbudget/i.test(allHead)) return parseJobDetail(ws);
  return { format: "unknown", financials: [], gc: null };
}

// Draw Sheet columns (fixed by the export template)
function parseDraw(ws: ExcelJS.Worksheet): DrawBudgetResult {
  const C = { orig: 3, revisions: 4, revised: 5, drawn: 8, remaining: 10, totRetn: 12 };
  const financials: FinHit[] = [];
  let gc: GcLine | null = null;

  for (let r = 1; r <= ws.rowCount; r++) {
    const b = labelOf(ws, r, 2).toLowerCase();
    if (!b) continue;
    const get = (col: number) => toNum(ws.getRow(r).getCell(col).value);

    if (b.includes("total construction hard costs")) {
      const push = (field: string, label: string, col: number) => {
        const v = get(col);
        if (v != null) financials.push({ field, label, value: v });
      };
      push("originalBudget", "Original Budget", C.orig);
      push("currentBudget", "Current Budget", C.revised);
      push("costsToDate", "Costs to Date", C.drawn);
      push("retainage", "Retainage", C.totRetn);
    } else if (b.includes("total hard cost contingency")) {
      const v = get(C.revised);
      if (v != null) financials.push({ field: "contingencyBalance", label: "Contingency Balance", value: v });
    } else if (/gc\/construction|gc construction/.test(b) && !b.startsWith("total")) {
      gc = {
        original: get(C.orig),
        changeOrder: get(C.revisions),
        total: get(C.revised),
        invoiced: get(C.drawn),
        remaining: get(C.remaining),
        retainage: get(C.totRetn),
      };
    }
  }
  return { format: "draw", financials, gc };
}

// Job Detail Report columns
function parseJobDetail(ws: ExcelJS.Worksheet): DrawBudgetResult {
  const C = { budget: 4, revision: 5, revbudget: 6, commit: 9, invoiced: 15, costToComplete: 22 };
  const financials: FinHit[] = [];
  let gc: GcLine | null = null;
  let sumRevbudget = 0;
  let sumInvoiced = 0;
  let has200 = false;

  for (let r = 1; r <= ws.rowCount; r++) {
    const code = labelOf(ws, r, 1);
    const b = labelOf(ws, r, 2).toLowerCase();
    const get = (col: number) => toNum(ws.getRow(r).getCell(col).value);

    if (/^200[-\s]?0?10/.test(code) || (/gc\/construction|gc construction/.test(b) && !b.startsWith("total"))) {
      gc = {
        original: get(C.budget),
        changeOrder: get(C.revision),
        total: get(C.revbudget),
        invoiced: get(C.invoiced),
        remaining: get(C.costToComplete),
        retainage: null,
      };
    }
    // sum the construction hard-cost series (200-xxx) for the budget subtotal
    if (/^200[-\s]/.test(code)) {
      has200 = true;
      sumRevbudget += get(C.revbudget) ?? 0;
      sumInvoiced += get(C.invoiced) ?? 0;
    }
  }
  if (has200) {
    if (sumRevbudget) financials.push({ field: "currentBudget", label: "Current Budget (200-series)", value: +sumRevbudget.toFixed(2) });
    if (sumInvoiced) financials.push({ field: "costsToDate", label: "Costs to Date (200-series)", value: +sumInvoiced.toFixed(2) });
  }
  return { format: "jobdetail", financials, gc };
}
